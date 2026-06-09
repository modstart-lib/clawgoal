import { Router } from 'express'
import multer from 'multer'
import { spawn } from 'child_process'
import { tmpdir } from 'os'
import { join } from 'path'
import { randomUUID } from 'crypto'
import { promises as fs } from 'fs'
import { useI18n } from '../../locale/index.js'

const router = Router()

function tempPath(ext: string): string {
  return join(
    tmpdir(),
    `awx_mock_${randomUUID().replace(/-/g, '').slice(0, 10)}.${ext}`
  )
}

function runFfmpeg(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    let stderr = ''
    const proc = spawn('ffmpeg', args)
    proc.stderr.on('data', (d: Buffer) => (stderr += d.toString()))
    proc.on('close', (code: number) => {
      if (code === 0) resolve()
      else reject(new Error(`ffmpeg mock 失败: ${stderr.slice(-400)}`))
    })
    proc.on('error', (e: Error) =>
      reject(new Error(`ffmpeg 未安装: ${e.message}`))
    )
  })
}

const mockUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
})

/** 生成内联 SVG 兜底头像（基于 seed 生成确定性颜色） */
function fallbackAvatarSvg(seed: string): string {
  const hash = Array.from(seed).reduce(
    (h, c) => (h * 31 + c.charCodeAt(0)) & 0xffffff,
    0x4169e1
  )
  const hue = hash % 360
  const initials = seed.slice(0, 2).toUpperCase()
  return `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
  <circle cx="32" cy="32" r="32" fill="hsl(${hue},60%,60%)"/>
  <text x="32" y="38" text-anchor="middle" font-size="22" font-family="sans-serif" fill="white">${initials}</text>
</svg>`
}

/** 生成内联 SVG 兜底封面（基于 seed 生成确定性颜色） */
function fallbackCoverSvg(seed: string): string {
  const hash = Array.from(seed).reduce(
    (h, c) => (h * 31 + c.charCodeAt(0)) & 0xffffff,
    0x6366f1
  )
  const hue = hash % 360
  const hue2 = (hue + 40) % 360
  return `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200">
  <defs>
    <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:hsl(${hue},70%,60%)"/>
      <stop offset="100%" style="stop-color:hsl(${hue2},70%,45%)"/>
    </linearGradient>
  </defs>
  <rect width="200" height="200" fill="url(#g)"/>
</svg>`
}

/**
 * 随机头像代理（SVG），转发 jsonfakery.com，失败时返回内联 SVG 兜底
 */
/**
 * @Api /api/mock/randomAvatar
 * @Method GET
 * @Summary 随机头像代理（SVG）
 * @QueryParam seed? string 随机种子
 * @ReturnDataExample "SVG image response (Content-Type: image/svg+xml)"
 */
router.get('/mock/randomAvatar', async (req, res) => {
  const seed = String(req.query.seed || Math.random().toString(36).slice(2, 10))
  res.setHeader('Content-Type', 'image/svg+xml')
  res.setHeader('Cache-Control', 'public, max-age=86400')
  try {
    const upstream = await fetch(
      `https://jsonfakery.com/avatars/get-avatar?seed=${encodeURIComponent(seed)}`,
      { signal: AbortSignal.timeout(3000) }
    )
    if (!upstream.ok) throw new Error(`upstream ${upstream.status}`)
    const svg = await upstream.text()
    res.send(svg)
  } catch {
    res.send(fallbackAvatarSvg(seed))
  }
})

/**
 * 随机封面图代理（SVG），转发 dicebear.com，失败时返回内联 SVG 兜底
 */
/**
 * @Api /api/mock/randomCover
 * @Method GET
 * @Summary 随机封面图代理（SVG）
 * @QueryParam seed? string 随机种子
 * @ReturnDataExample "SVG image response (Content-Type: image/svg+xml)"
 */
router.get('/mock/randomCover', async (req, res) => {
  const seed = String(req.query.seed || Math.random().toString(36).slice(2, 10))
  res.setHeader('Content-Type', 'image/svg+xml')
  res.setHeader('Cache-Control', 'public, max-age=86400')
  try {
    const upstream = await fetch(
      `https://api.dicebear.com/9.x/icons/svg?seed=${encodeURIComponent(seed)}`,
      { signal: AbortSignal.timeout(3000) }
    )
    if (!upstream.ok) throw new Error(`upstream ${upstream.status}`)
    const buf = await upstream.arrayBuffer()
    res.send(Buffer.from(buf))
  } catch {
    res.send(fallbackCoverSvg(seed))
  }
})

const _IMAGE_KEYWORDS = [
  'nature',
  'mountain',
  'ocean',
  'forest',
  'city',
  'sunset',
  'sky',
  'beach',
  'snow',
  'river',
  'desert',
  'flowers',
  'architecture',
  'abstract',
  'travel',
  'landscape',
]

/**
 * 随机图片代理，转发 picsum.photos/seed/{keywords}/800/480
 * seed 为空时从关键词池随机取一个，失败时返回内联 SVG 兜底
 */
/**
 * @Api /api/mock/randomImage
 * @Method GET
 * @Summary 随机图片代理（JPEG）
 * @QueryParam keywords? string 图片关键词
 * @QueryParam w? number 宽度（默认 800）
 * @QueryParam h? number 高度（默认 480）
 * @ReturnDataExample "JPEG image response (Content-Type: image/jpeg)"
 */
router.get('/mock/randomImage', async (req, res) => {
  const keywords = req.query.keywords
    ? String(req.query.keywords)
    : _IMAGE_KEYWORDS[Math.floor(Math.random() * _IMAGE_KEYWORDS.length)]
  const w = req.query.w ? parseInt(String(req.query.w), 10) || 800 : 800
  const h = req.query.h ? parseInt(String(req.query.h), 10) || 480 : 480
  try {
    const upstream = await fetch(
      `https://picsum.photos/seed/${encodeURIComponent(keywords)}/${w}/${h}`,
      { signal: AbortSignal.timeout(3000) }
    )
    if (!upstream.ok) throw new Error(`upstream ${upstream.status}`)
    const buf = await upstream.arrayBuffer()
    res.setHeader(
      'Content-Type',
      upstream.headers.get('content-type') || 'image/jpeg'
    )
    res.setHeader('Cache-Control', 'public, max-age=86400')
    res.send(Buffer.from(buf))
  } catch {
    res.setHeader('Content-Type', 'image/svg+xml')
    res.setHeader('Cache-Control', 'public, max-age=86400')
    res.send(fallbackCoverSvg(keywords))
  }
})

/**
 * Mock MCP 服务端点（JSON-RPC 2.0）
 * 用于开发/测试无需真实 MCP 服务器时直接返回 mock 数据
 *
 * @Api /api/mock/mcp
 * @Method POST
 * @Summary Mock MCP 服务端（tools/list、tools/call）
 * @BodyParam method string JSON-RPC method (tools/list or tools/call)
 * @BodyParam params object Method-specific parameters
 * @BodyParam id number JSON-RPC request ID
 * @ReturnDataExample {"jsonrpc":"2.0","id":1,"result":{"tools":[{"name":"mock_tool","description":"Mock 工具","inputSchema":{}}]}}
 */
router.post('/mock/mcp', (req, res) => {
  const { method, params, id } = req.body || {}
  if (method === 'tools/list') {
    return res.json({
      jsonrpc: '2.0',
      id,
      result: {
        tools: [
          {
            name: 'mock_tool',
            description: 'Mock 工具（开发测试用）',
            inputSchema: {
              type: 'object',
              properties: {
                input: { type: 'string', description: '输入内容' },
              },
            },
          },
        ],
      },
    })
  }
  if (method === 'tools/call') {
    const toolName = params?.name || ''
    const args = params?.arguments || {}
    return res.json({
      jsonrpc: '2.0',
      id,
      result: {
        content: [
          {
            type: 'text',
            text: `[Mock MCP] tool=${toolName} args=${JSON.stringify(args)} result=ok`,
          },
        ],
      },
    })
  }
  return res.json({
    jsonrpc: '2.0',
    id,
    error: { code: -32601, message: `Method not found: ${method}` },
  })
})

/**
 * Mock TTS：文本转音频
 * @Api /api/mock/tts
 * @Method POST
 * @Summary 将文本转为 MP3 音频（无需真实 TTS 服务，用 ffmpeg lavfi 生成正弦波）
 * @BodyParam text string 要转换的文字
 * @ReturnDataExample "MP3 audio binary response (Content-Type: audio/mpeg)"
 */
router.post('/mock/tts', async (req, res) => {
  const text = String(req.body?.text || '')
  const duration = Math.max(1, Math.min(10, Math.ceil(text.length / 20)))
  const output = tempPath('mp3')
  try {
    await runFfmpeg([
      '-f',
      'lavfi',
      '-i',
      `sine=frequency=440:duration=${duration}`,
      '-c:a',
      'libmp3lame',
      '-q:a',
      '4',
      '-y',
      output,
    ])
    const buf = await fs.readFile(output)
    res.setHeader('Content-Type', 'audio/mpeg')
    res.setHeader('Content-Disposition', 'attachment; filename="tts.mp3"')
    res.send(buf)
  } catch (e: any) {
    const { t } = useI18n(req)
    res.status(500).json({
      code: 1,
      msg: t(
        e.message?.includes('未安装')
          ? 'MockFfmpegNotInstalled'
          : 'MockFfmpegFailed'
      ),
    })
  } finally {
    fs.unlink(output).catch(() => {})
  }
})

/**
 * Mock SubtitleTts：字幕转音频
 * @Api /api/mock/subtitleTts
 * @Method POST
 * @Summary 将 SRT 字幕内容转为 MP3 音频（无需真实 TTS 服务，按字幕时长生成静音）
 * @BodyParam srt string SRT 字幕内容
 * @ReturnDataExample "MP3 audio binary response (Content-Type: audio/mpeg)"
 */
router.post('/mock/subtitleTts', async (req, res) => {
  const srt = String(req.body?.srt || '')
  const matches = srt.match(/--> (\d{2}):(\d{2}):(\d{2}),(\d{3})/g)
  let duration = 2
  if (matches && matches.length > 0) {
    const last = matches[matches.length - 1]
    const m = last.match(/--> (\d{2}):(\d{2}):(\d{2}),(\d{3})/)
    if (m) {
      duration =
        parseInt(m[1]) * 3600 +
        parseInt(m[2]) * 60 +
        parseInt(m[3]) +
        parseInt(m[4]) / 1000
    }
  }
  duration = Math.max(1, Math.min(30, duration))
  const output = tempPath('mp3')
  try {
    await runFfmpeg([
      '-f',
      'lavfi',
      '-i',
      `anullsrc=r=44100:cl=mono`,
      '-t',
      String(duration),
      '-c:a',
      'libmp3lame',
      '-q:a',
      '4',
      '-y',
      output,
    ])
    const buf = await fs.readFile(output)
    res.setHeader('Content-Type', 'audio/mpeg')
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="subtitle_tts.mp3"'
    )
    res.send(buf)
  } catch (e: any) {
    const { t } = useI18n(req)
    res.status(500).json({
      code: 1,
      msg: t(
        e.message?.includes('未安装')
          ? 'MockFfmpegNotInstalled'
          : 'MockFfmpegFailed'
      ),
    })
  } finally {
    fs.unlink(output).catch(() => {})
  }
})

/**
 * Mock TextToImage：文本生成图片
 * @Api /api/mock/textToImage
 * @Method POST
 * @Summary 将文本描述生成图片（无需真实 AI 服务，用 ffmpeg 生成纯色图）
 * @BodyParam prompt string 图像描述文字
 * @BodyParam width? number 宽度（默认 512）
 * @BodyParam height? number 高度（默认 512）
 * @ReturnDataExample "JPEG image binary response (Content-Type: image/jpeg)"
 */
router.post('/mock/textToImage', async (req, res) => {
  const prompt = String(req.body?.prompt || 'image')
  const width = Number(req.body?.width || 512)
  const height = Number(req.body?.height || 512)
  const hash = Array.from(prompt).reduce(
    (h, c) => (h * 31 + c.charCodeAt(0)) & 0xffffff,
    0x4169e1
  )
  const hex = hash.toString(16).padStart(6, '0')
  const output = tempPath('jpg')
  try {
    await runFfmpeg([
      '-f',
      'lavfi',
      '-i',
      `color=c=0x${hex}:s=${width}x${height}`,
      '-frames:v',
      '1',
      '-update',
      '1',
      '-y',
      output,
    ])
    const buf = await fs.readFile(output)
    res.setHeader('Content-Type', 'image/jpeg')
    res.setHeader('Content-Disposition', 'attachment; filename="generated.jpg"')
    res.send(buf)
  } catch (e: any) {
    const { t } = useI18n(req)
    res.status(500).json({
      code: 1,
      msg: t(
        e.message?.includes('未安装')
          ? 'MockFfmpegNotInstalled'
          : 'MockFfmpegFailed'
      ),
    })
  } finally {
    fs.unlink(output).catch(() => {})
  }
})

/**
 * Mock ImageToImage：图生图
 * @Api /api/mock/imageToImage
 * @Method POST (multipart/form-data)
 * @Summary 根据图片和描述生成新图（无需真实 AI 服务，用 ffmpeg hue 滤镜做色调转换）
 * @BodyParam image File 源图片文件
 * @BodyParam prompt string 转换风格描述
 * @ReturnDataExample "JPEG image binary response (Content-Type: image/jpeg)"
 */
router.post(
  '/mock/imageToImage',
  mockUpload.single('image'),
  async (req, res) => {
    const file = req.file as Express.Multer.File | undefined
    const prompt = String(req.body?.prompt || 'style')
    if (!file) {
      const { t } = useI18n(req)
      return res.status(400).json({ code: 1, msg: t('mockImageFileRequired') })
    }
    const hue = Array.from(prompt).reduce(
      (h, c) => (h * 31 + c.charCodeAt(0)) % 360,
      90
    )
    const inputPath = tempPath('jpg')
    const output = tempPath('jpg')
    try {
      await fs.writeFile(inputPath, file.buffer)
      await runFfmpeg([
        '-i',
        inputPath,
        '-vf',
        `hue=h=${hue},eq=saturation=1.4:contrast=1.1`,
        '-frames:v',
        '1',
        '-update',
        '1',
        '-y',
        output,
      ])
      const buf = await fs.readFile(output)
      res.setHeader('Content-Type', 'image/jpeg')
      res.setHeader('Content-Disposition', 'attachment; filename="i2i.jpg"')
      res.send(buf)
    } catch (e: any) {
      const { t } = useI18n(req)
      res.status(500).json({
        code: 1,
        msg: t(
          e.message?.includes('未安装')
            ? 'MockFfmpegNotInstalled'
            : 'MockFfmpegFailed'
        ),
      })
    } finally {
      await fs.unlink(inputPath).catch(() => {})
      await fs.unlink(output).catch(() => {})
    }
  }
)

export default router
