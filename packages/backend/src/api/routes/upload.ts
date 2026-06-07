import { Router } from 'express'
import multer from 'multer'
import { config, isAllowedExtension, isAllowedSize } from '../../config'
import { useI18n } from '../../locale'
import { apiHandler } from '../../utils/api'
import { error, success } from '../../utils/response'
import { getFileUrl, getStorage } from '../../utils/storage'
import { generateFilePath } from '../../utils/utils'
import type { AuthRequest } from '../middlewares/auth.js'
import { ResponseCodes } from '../types/constants'

const router = Router()

const uploadMiddleware = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: config.upload.limitSize,
  },
})

/**
 * @Api /api/upload/image
 * @Summary Image
 * @BodyParam file File (multipart/form-data) Single image file
 * @ReturnDataExample {"url":"https://...","filename":"2026/03/abc.jpg","originalName":"photo.jpg","size":102400,"mimetype":"image/jpeg"}
 */
router.post(
  '/upload/image',
  uploadMiddleware.single('file'),
  apiHandler(async (req, res) => {
    const authReq = req as AuthRequest
    const { t } = useI18n(req)
    const file = req.file as Express.Multer.File

    if (!file) {
      return error(res, ResponseCodes.DEFAULT_ERROR, t('uploadNoFile'))
    }

    if (!isAllowedExtension(file.originalname)) {
      const allowedExts = config.upload.limitExt
      return error(
        res,
        ResponseCodes.DEFAULT_ERROR,
        `${file.originalname} ${t('uploadFileExtNotAllowed')}: ${allowedExts}`
      )
    }

    if (!isAllowedSize(file.size)) {
      const limitMB = (config.upload.limitSize / 1024 / 1024).toFixed(2)
      return error(
        res,
        ResponseCodes.DEFAULT_ERROR,
        `${file.originalname} ${t('uploadFileSizeExceeded')}: ${limitMB}MB)`
      )
    }

    const memberUserId = authReq.user.userId
    const storage = await getStorage(memberUserId)
    const filename = generateFilePath(file.originalname)
    await storage.put(filename, file.buffer, file.mimetype)

    return success(
      res,
      {
        url: await getFileUrl(filename),
        filename: filename,
        originalName: file.originalname,
        size: file.size,
        mimetype: file.mimetype,
      },
      t('uploadSuccess')
    )
  })
)

/**
 * @Api /api/upload
 * @Summary Upload
 * @BodyParam file File (multipart/form-data) One or more files
 * @ReturnDataExample {"files":[{"url":"https://...","filename":"2026/03/abc.jpg","originalName":"photo.jpg","size":102400,"mimetype":"image/jpeg"}]}
 */
router.post(
  '/upload',
  uploadMiddleware.any(),
  apiHandler(async (req, res) => {
    const authReq = req as AuthRequest
    const { t } = useI18n(req)
    const files = req.files as Express.Multer.File[]

    if (!files || files.length === 0) {
      return error(res, ResponseCodes.DEFAULT_ERROR, t('uploadNoFile'))
    }

    for (const file of files) {
      if (!isAllowedExtension(file.originalname)) {
        const allowedExts = config.upload.limitExt
        return error(
          res,
          ResponseCodes.DEFAULT_ERROR,
          `${file.originalname} ${t('uploadFileExtNotAllowed')}: ${allowedExts}`
        )
      }

      if (!isAllowedSize(file.size)) {
        const limitMB = (config.upload.limitSize / 1024 / 1024).toFixed(2)
        return error(
          res,
          ResponseCodes.DEFAULT_ERROR,
          `${file.originalname} ${t('uploadFileSizeExceeded')}: ${limitMB}MB)`
        )
      }
    }

    const memberUserId = authReq.user.userId
    const storage = await getStorage(memberUserId)
    const uploadResults = []

    for (const file of files) {
      const filename = generateFilePath(file.originalname)
      await storage.put(filename, file.buffer, file.mimetype)

      uploadResults.push({
        url: await getFileUrl(filename),
        filename: filename,
        originalName: file.originalname,
        size: file.size,
        mimetype: file.mimetype,
      })
    }

    const result = uploadResults.length === 1 ? uploadResults[0] : uploadResults
    return success(res, result, t('uploadSuccess'))
  })
)

export default router
