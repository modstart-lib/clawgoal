/**
 * Sliding captcha routes — real image PNG implementation
 * Uses PNG images from assets/captcha; decoding via pngjs.
 */
import { Request, Response, Router } from 'express'
import { readFileSync } from 'fs'
import { nanoid } from 'nanoid'
import { PNG } from 'pngjs'
import { deflateSync } from 'zlib'
import catPngB64 from '../../assets/captcha/cat.png'
import dogPngB64 from '../../assets/captcha/dog.png'
import { apiHandler } from '../../utils/api'
import { useI18n } from '../../locale'
import { error, success } from '../../utils/response'
import { ResponseCodes } from '../types/constants'

const router = Router()

// pending captchas: token → {x, expires}
const pendingCaptchas = new Map<string, { x: number; expires: number }>()
// verified captcha tokens (one-time use for login): token → {expires}
const verifiedCaptchas = new Map<string, { expires: number }>()

const CAPTCHA_EXPIRE_MS = 5 * 60 * 1000
const VERIFIED_EXPIRE_MS = 3 * 60 * 1000
const TOLERANCE = 5

setInterval(() => {
  const now = Date.now()
  for (const [k, v] of pendingCaptchas)
    if (v.expires < now) pendingCaptchas.delete(k)
  for (const [k, v] of verifiedCaptchas)
    if (v.expires < now) verifiedCaptchas.delete(k)
}, 60_000)

const IMG_W = 300
const IMG_H = 150
const PIECE_W = 42
const PIECE_H = 42
const BUMP_R = Math.round(PIECE_W * 0.22) // ~9px

// ── Load captcha background images (embedded via base64 import) ─────────────
interface CaptchaImage {
  width: number
  height: number
  data: Buffer
}

function loadPngBuffer(b64OrPath: string): Buffer {
  // bun --watch (dev) returns real file path; bun build --compile (--loader .png:file) returns /$bunfs/ virtual path
  // both are handled by readFileSync; base64 fallback kept for tsup builds
  if (b64OrPath.startsWith('/') || /^[A-Za-z]:[\\/]/.test(b64OrPath)) {
    return readFileSync(b64OrPath)
  }
  return Buffer.from(b64OrPath, 'base64')
}

const captchaImages: CaptchaImage[] = [catPngB64, dogPngB64].map((b64) => {
  const png = PNG.sync.read(loadPngBuffer(b64))
  return { width: png.width, height: png.height, data: png.data }
})

// ── Minimal PNG encoder (no external deps) ──────────────────────────────────
const CRC32_TABLE = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c
  }
  return t
})()

function crc32(buf: Buffer): number {
  let crc = 0xffffffff
  for (const b of buf) crc = (crc >>> 8) ^ CRC32_TABLE[(crc ^ b) & 0xff]
  return (crc ^ 0xffffffff) >>> 0
}

function pngChunk(type: string, data: Buffer): Buffer {
  const tb = Buffer.from(type)
  const lb = Buffer.alloc(4)
  lb.writeUInt32BE(data.length)
  const cb = Buffer.alloc(4)
  cb.writeUInt32BE(crc32(Buffer.concat([tb, data])))
  return Buffer.concat([lb, tb, data, cb])
}

const PNG_SIG = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])

function encodePngRGB(pixels: Uint8Array, w: number, h: number): Buffer {
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(w, 0)
  ihdr.writeUInt32BE(h, 4)
  ihdr[8] = 8
  ihdr[9] = 2 // 8-bit RGB
  const raw = Buffer.alloc(h * (1 + w * 3))
  for (let y = 0; y < h; y++) {
    raw[y * (1 + w * 3)] = 0 // filter None
    for (let x = 0; x < w; x++) {
      const si = (y * w + x) * 3,
        di = y * (1 + w * 3) + 1 + x * 3
      raw[di] = pixels[si]
      raw[di + 1] = pixels[si + 1]
      raw[di + 2] = pixels[si + 2]
    }
  }
  return Buffer.concat([
    PNG_SIG,
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', deflateSync(raw)),
    pngChunk('IEND', Buffer.alloc(0)),
  ])
}

function encodePngRGBA(pixels: Uint8Array, w: number, h: number): Buffer {
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(w, 0)
  ihdr.writeUInt32BE(h, 4)
  ihdr[8] = 8
  ihdr[9] = 6 // 8-bit RGBA
  const raw = Buffer.alloc(h * (1 + w * 4))
  for (let y = 0; y < h; y++) {
    raw[y * (1 + w * 4)] = 0
    for (let x = 0; x < w; x++) {
      const si = (y * w + x) * 4,
        di = y * (1 + w * 4) + 1 + x * 4
      raw[di] = pixels[si]
      raw[di + 1] = pixels[si + 1]
      raw[di + 2] = pixels[si + 2]
      raw[di + 3] = pixels[si + 3]
    }
  }
  return Buffer.concat([
    PNG_SIG,
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', deflateSync(raw)),
    pngChunk('IEND', Buffer.alloc(0)),
  ])
}

// ── Puzzle shape helpers ────────────────────────────────────────────────────
/** Is pixel (px,py) inside the puzzle piece at (ox,oy)? (rect + right-side bump) */
function inPiece(px: number, py: number, ox: number, oy: number): boolean {
  if (py < oy || py >= oy + PIECE_H) return false
  if (px >= ox && px < ox + PIECE_W) return true
  const dx = px - (ox + PIECE_W),
    dy = py - (oy + PIECE_H / 2)
  return dx >= 0 && dx * dx + dy * dy <= BUMP_R * BUMP_R
}

/** Is pixel on the 1-px outline of the piece? */
function onPieceBorder(
  px: number,
  py: number,
  ox: number,
  oy: number
): boolean {
  if (!inPiece(px, py, ox, oy)) return false
  return (
    !inPiece(px - 1, py, ox, oy) ||
    !inPiece(px + 1, py, ox, oy) ||
    !inPiece(px, py - 1, ox, oy) ||
    !inPiece(px, py + 1, ox, oy)
  )
}

// ── Route ───────────────────────────────────────────────────────────────────
/**
 * @Api /api/captcha/generate
 * @Summary Generate captcha
 * @ReturnDataExample {"bgImg":"data:image/png;base64,...","pieceImg":"data:image/png;base64,...","token":"abc123"}
 */
router.post(
  '/captcha/generate',
  apiHandler(async (_req: Request, res: Response) => {
    const img = captchaImages[Math.floor(Math.random() * captchaImages.length)]

    // Random crop from image (e.g. 800x500 → 300x150)
    const cropX = Math.floor(Math.random() * (img.width - IMG_W))
    const cropY = Math.floor(Math.random() * (img.height - IMG_H))

    const pieceX =
      Math.floor(Math.random() * (IMG_W - PIECE_W * 3)) + PIECE_W * 2
    const pieceY =
      Math.floor(Math.random() * (IMG_H - PIECE_H * 2)) +
      Math.floor(PIECE_H / 2)
    const decoyX = Math.floor(Math.random() * (IMG_W - PIECE_W * 3)) + PIECE_W
    const decoyY =
      Math.floor(Math.random() * (IMG_H - PIECE_H * 2)) +
      Math.floor(PIECE_H / 2)

    // Helper: get RGB from source image at canvas coordinate (x, y)
    const imgRgb = (x: number, y: number): [number, number, number] => {
      const si = ((cropY + y) * img.width + (cropX + x)) * 4
      return [img.data[si], img.data[si + 1], img.data[si + 2]]
    }

    // ── Background (RGB PNG) ───────────────────────────────────────────────
    const bgPx = new Uint8Array(IMG_W * IMG_H * 3)

    for (let y = 0; y < IMG_H; y++) {
      for (let x = 0; x < IMG_W; x++) {
        const [r, g, b] = imgRgb(x, y)
        const i = (y * IMG_W + x) * 3
        bgPx[i] = r
        bgPx[i + 1] = g
        bgPx[i + 2] = b
      }
    }

    // Decoy hole (lighter overlay)
    for (let y = 0; y < IMG_H; y++) {
      for (let x = 0; x < IMG_W; x++) {
        const i = (y * IMG_W + x) * 3
        if (inPiece(x, y, decoyX, decoyY)) {
          bgPx[i] = Math.round(bgPx[i] * 0.65)
          bgPx[i + 1] = Math.round(bgPx[i + 1] * 0.65)
          bgPx[i + 2] = Math.round(bgPx[i + 2] * 0.65)
        }
        if (onPieceBorder(x, y, decoyX, decoyY)) {
          bgPx[i] = Math.round(bgPx[i] * 0.4 + 255 * 0.35)
          bgPx[i + 1] = Math.round(bgPx[i + 1] * 0.4 + 255 * 0.35)
          bgPx[i + 2] = Math.round(bgPx[i + 2] * 0.4 + 255 * 0.35)
        }
      }
    }

    // Real hole (darker overlay + bright border)
    for (let y = 0; y < IMG_H; y++) {
      for (let x = 0; x < IMG_W; x++) {
        const i = (y * IMG_W + x) * 3
        if (inPiece(x, y, pieceX, pieceY)) {
          bgPx[i] = Math.round(bgPx[i] * 0.45)
          bgPx[i + 1] = Math.round(bgPx[i + 1] * 0.45)
          bgPx[i + 2] = Math.round(bgPx[i + 2] * 0.45)
        }
        if (onPieceBorder(x, y, pieceX, pieceY)) {
          bgPx[i] = Math.round(bgPx[i] * 0.2 + 255 * 0.8)
          bgPx[i + 1] = Math.round(bgPx[i + 1] * 0.2 + 255 * 0.8)
          bgPx[i + 2] = Math.round(bgPx[i + 2] * 0.2 + 255 * 0.8)
        }
      }
    }

    // ── Piece (RGBA PNG, transparent outside shape) ────────────────────────
    const pcPx = new Uint8Array(PIECE_W * IMG_H * 4)
    for (let y = 0; y < IMG_H; y++) {
      for (let x = 0; x < PIECE_W; x++) {
        const srcX = x + pieceX
        const i = (y * PIECE_W + x) * 4
        if (inPiece(srcX, y, pieceX, pieceY)) {
          const [r, g, b] = imgRgb(srcX, y)
          pcPx[i] = r
          pcPx[i + 1] = g
          pcPx[i + 2] = b
          pcPx[i + 3] = 255
        }
      }
    }
    // White border on piece
    for (let y = 0; y < IMG_H; y++) {
      for (let x = 0; x < PIECE_W; x++) {
        if (onPieceBorder(x + pieceX, y, pieceX, pieceY)) {
          const i = (y * PIECE_W + x) * 4
          pcPx[i] = 255
          pcPx[i + 1] = 255
          pcPx[i + 2] = 255
          pcPx[i + 3] = 210
        }
      }
    }

    const token = nanoid(32)
    pendingCaptchas.set(token, {
      x: pieceX,
      expires: Date.now() + CAPTCHA_EXPIRE_MS,
    })

    return success(res, {
      bgImg: `data:image/png;base64,${encodePngRGB(bgPx, IMG_W, IMG_H).toString('base64')}`,
      pieceImg: `data:image/png;base64,${encodePngRGBA(pcPx, PIECE_W, IMG_H).toString('base64')}`,
      token,
    })
  })
)

/**
 * @Api /api/captcha/verify
 * @Summary Verify captcha
 * @BodyParam token string Captcha token from generate response
 * @BodyParam x number Drag x position of the puzzle piece
 * @ReturnDataExample {"verifiedToken":"abc123"}
 */
router.post(
  '/captcha/verify',
  apiHandler(async (req: Request, res: Response) => {
    const { t } = useI18n(req)
    const { token, x } = req.body
    if (!token || x === undefined || x === null) {
      return error(res, ResponseCodes.CAPTCHA_ERROR, t('captchaParamError'))
    }

    const captcha = pendingCaptchas.get(String(token))
    if (!captcha || captcha.expires < Date.now()) {
      pendingCaptchas.delete(String(token))
      return error(res, ResponseCodes.CAPTCHA_ERROR, t('captchaExpired'))
    }

    pendingCaptchas.delete(String(token))

    if (Math.abs(Number(x) - captcha.x) > TOLERANCE) {
      return error(res, ResponseCodes.CAPTCHA_ERROR, t('captchaPositionError'))
    }

    const verifiedToken = nanoid(32)
    verifiedCaptchas.set(verifiedToken, {
      expires: Date.now() + VERIFIED_EXPIRE_MS,
    })

    return success(res, { verifiedToken })
  })
)

export function consumeVerifiedCaptcha(token: string): boolean {
  const entry = verifiedCaptchas.get(token)
  if (!entry || entry.expires < Date.now()) {
    verifiedCaptchas.delete(token)
    return false
  }
  verifiedCaptchas.delete(token)
  return true
}

export default router
