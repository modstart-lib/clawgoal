import express, { Request, Response } from 'express'
import { success } from '../../utils/response'
import { apiDocData } from '../../generated/apiDocData.js'
import accountRouter from './account'
import apiTokenRouter from './settingApiToken'
import authRouter from './auth'
import captchaRouter from './captcha'
import configRouter from './config'
import fileRouter from './settingFile'
import sqliteRouter from './settingSqlite'
import mockRouter from './mock'
import modelRouter from './model'
import modelLogRouter from './settingModelLog'
import noticeRouter from './settingNotice'
import paramRouter from './userParam'
import settingRouter from './setting'
import systemRouter from './system'
import uploadRouter from './upload'
import reportRouter from './report'
import tempFileRouter from './userTempFile'
import userRouter from './user'

const router = express.Router()

const APP_TYPE = process.env.APP_TYPE || ''

/**
 * @Api /api/ping
 * @Summary Health check endpoint
 * @ReturnDataExample {"ready":true,"timestamp":"2026-01-01T00:00:00.000Z"}
 */
router.post('/ping', (_req: Request, res: Response) => {
  success(res, {
    ready: true,
    timestamp: new Date().toISOString(),
  })
})

/**
 * @Api /api/apiDoc.json
 * @Summary Serve API documentation JSON (Swagger/OpenAPI spec)
 * @ReturnDataExample {"openapi":"3.0.0","info":{},"paths":{}}
 */
router.get('/apiDoc.json', (_req: Request, res: Response) => {
  res.json(apiDocData)
})

/**
 * @Api /api/apiDoc
 * @Summary Serve Swagger UI for API documentation
 */
router.get('/apiDoc', (_req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  res.send(`<!DOCTYPE html>
<html>
<head>
  <title>API Docs</title>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist/swagger-ui.css">
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist/swagger-ui-bundle.js"></script>
  <script>
    SwaggerUIBundle({ url: '/api/apiDoc.json', dom_id: '#swagger-ui', presets: [SwaggerUIBundle.presets.apis, SwaggerUIBundle.SwaggerUIStandalonePreset] })
  </script>
</body>
</html>`)
})

router.use(captchaRouter)
router.use(userRouter)
router.use(authRouter)
router.use(accountRouter)
router.use(modelRouter)
router.use(modelLogRouter)
router.use(uploadRouter)
router.use(mockRouter)
router.use(configRouter)
router.use(settingRouter)
router.use(systemRouter)
router.use(apiTokenRouter)
router.use(paramRouter)
router.use(noticeRouter)
router.use(fileRouter)
router.use(sqliteRouter)
router.use(tempFileRouter)
router.use(reportRouter)

if (!APP_TYPE || APP_TYPE === 'claw') {
  const { useClawConfigRouter, useClawRouter } =
    await import('../../../../backend-claw/src/index.js')
  router.use(useClawConfigRouter())
  router.use(useClawRouter())
}















export default router
