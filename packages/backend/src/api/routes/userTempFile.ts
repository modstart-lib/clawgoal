import { Router, type Request, type Response } from 'express'
import fs from 'node:fs'
import path from 'node:path'
import { userTempFileDb } from '../../storage/store/userTempFile.js'
import { userTempFileFromContent } from '../../utils/userTempFile.js'
import { apiHandler } from '../../utils/api.js'
import { useI18n } from '../../locale/index.js'
import { success } from '../../utils/response.js'

const router = Router()

const INLINE_EXTS = new Set([
  'log',
  'json',
  'txt',
  'md',
  'yaml',
  'yml',
  'csv',
  'xml',
  'html',
  'htm',
  'js',
  'ts',
  'sh',
])

const MIME_MAP: Record<string, string> = {
  json: 'application/json',
  txt: 'text/plain',
  log: 'text/plain',
  md: 'text/plain',
  yaml: 'text/plain',
  yml: 'text/plain',
  csv: 'text/csv',
  xml: 'application/xml',
  html: 'text/html',
  htm: 'text/html',
  js: 'application/javascript',
  ts: 'text/plain',
  sh: 'text/plain',
  pdf: 'application/pdf',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  mp4: 'video/mp4',
  mp3: 'audio/mpeg',
  zip: 'application/zip',
}

/**
 * @Api GET /user_temp_file/:pathext
 * @Summary 访问临时文件，无需鉴权；过期后返回 404
 */
router.get('/user_temp_file/:pathext', async (req: Request, res: Response) => {
  const { t } = useI18n(req)
  const pathext = req.params.pathext as string
  const dotIdx = pathext.lastIndexOf('.')
  const pathKey = dotIdx >= 0 ? pathext.slice(0, dotIdx) : pathext
  const extPart = dotIdx >= 0 ? pathext.slice(dotIdx + 1).toLowerCase() : ''
  const record = await userTempFileDb.findByPath(pathKey)
  if (!record)
    return res
      .status(404)
      .json({ code: 404, msg: t('userTempFileNotFoundOrExpired') })
  if (record.expireAt <= new Date()) {
    await userTempFileDb.deleteByPath(pathKey)
    return res.status(404).json({ code: 404, msg: t('userTempFileExpired') })
  }
  if (!fs.existsSync(record.localPath))
    return res.status(404).json({ code: 404, msg: t('userTempFileNotFound') })
  const ext = (
    record.ext ||
    extPart ||
    path.extname(record.localPath).slice(1)
  ).toLowerCase()
  const mimeType = MIME_MAP[ext] || 'application/octet-stream'
  if (INLINE_EXTS.has(ext)) {
    res.setHeader('Content-Type', `${mimeType}; charset=utf-8`)
    res.setHeader('Content-Disposition', 'inline')
  } else {
    res.setHeader('Content-Type', mimeType)
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="file.${ext || 'bin'}"`
    )
  }
  const stat = fs.statSync(record.localPath)
  res.setHeader('Content-Length', stat.size)
  return fs.createReadStream(record.localPath).pipe(res)
})

/**
 * @Api /user_temp_file/createFromContent
 * @Summary 从内容创建临时文件并返回访问链接
 * @BodyParam content string 文件内容
 * @BodyParam ext? string 扩展名（默认 txt）
 * @BodyParam expire? number 有效秒数（默认 86400）
 * @ReturnDataExample {"url":"/api/user_temp_file/abc123.txt"}
 */
router.post(
  '/user_temp_file/createFromContent',
  apiHandler(async (req, res) => {
    const { content, ext, expire } = req.body as {
      content: string
      ext?: string
      expire?: number
    }
    const url = await userTempFileFromContent(
      content,
      expire ?? 86400,
      null,
      ext ?? 'txt'
    )
    success(res, { url })
  })
)

export default router
