import { config } from './config'

import express, { NextFunction, Request, Response } from 'express'
import path from 'path'

import fs from 'fs'
import { authMiddleware } from './api/middlewares/auth.js'
import { httpLogger } from './api/middlewares/logger.js'
import apiRoutes from './api/routes/api.js'
import { ResponseCodes } from './api/types/constants.js'
import { resolvePath } from './config/env.js'
import { initDatabase } from './storage/migrate.js'
import { logger } from './utils/logger.js'
import { reportSystemError } from './utils/report.js'
import { error } from './utils/response.js'
import { getLocalTimeStr } from './utils/time.js'
import { isServerReady, setServerReady } from './serverReady.js'

// Module mode: resolved from APP_TYPE env var.
const APP_TYPE = process.env.APP_TYPE || ''

const app = express()
const PORT = config.port

// Flag set to true once DB migration, app modules, and schedulers have finished.
// Until then, all /api routes (including /ping) return 503 so callers can poll ping for readiness.

app.use((req: Request, res: Response, next: NextFunction) => {
  res.header('Access-Control-Allow-Origin', '*')
  res.header('Access-Control-Allow-Methods', '*')
  res.header(
    'Access-Control-Allow-Headers',
    'Content-Type, Authorization, Accept'
  )
  if (req.method === 'OPTIONS') {
    return res.sendStatus(204)
  }
  return next()
})
app.use(express.json())
app.use(express.urlencoded({ extended: true }))
app.use(httpLogger)

// Early readiness gate — must come before auth and route handlers
app.use('/api', (req: Request, res: Response, next: NextFunction) => {
  if (!isServerReady()) {
    return res
      .status(503)
      .json({ code: 503, msg: 'Server is initializing, please wait...' })
  }
  return next()
})

app.use('/api', (req: Request, res: Response, next: NextFunction) => {
  const publicPaths = [
    '/login',
    '/login/auto',
    '/ping',
    '/error',
    '/collect',
    '/setting/basic',
    '/apiDoc.json',
    '/apiDoc',
  ]
  if (
    publicPaths.includes(req.path) ||
    req.path.startsWith('/captcha/') ||
    req.path.startsWith('/mock/') ||
    req.path.startsWith('/user_temp_file/')
  ) {
    return next()
  }
  if (req.path.startsWith('/hook/')) {
    return next()
  }
  // 公开分享访问：GET /claw/event/share/<id>_<hash> 或 /claw/note/share/<id>_<hash>
  if (
    req.method === 'GET' &&
    (/^\/claw\/event\/share\/\d+_[a-z0-9]+$/.test(req.path) ||
      /^\/claw\/note\/share\/\d+_[a-z0-9]+$/.test(req.path))
  ) {
    return next()
  }
  if (req.path.startsWith('/ops/_git/')) {
    return next()
  }
  return authMiddleware(req, res, next)
})

app.use('/api', apiRoutes)

const uploadsPath = config.upload.local.path
app.use('/uploads', express.static(uploadsPath))

// Serve files from data/public/ at root URL (e.g. /xxx.bin)
const publicPath = path.join(config.dataPath, 'public')
if (fs.existsSync(publicPath)) {
  app.use(express.static(publicPath))
}

const isCompiledBinary = (process.argv[1] ?? '').startsWith('/$bunfs/')

let uiDistPath: string | undefined

if (isCompiledBinary) {
  const {
    initEmbeddedStatic,
    embeddedStaticMiddleware,
    sendEmbeddedIndexHtml,
  } = await import('./utils/embeddedStatic.js')
  await initEmbeddedStatic()
  app.use(embeddedStaticMiddleware)
  app.get('*', (req: Request, res: Response) => {
    if (req.path.startsWith('/api')) {
      return res.status(404).json({ error: 'API endpoint not found' })
    }
    // 有文件扩展名的静态资源请求（如 .ico/.png/.js）找不到时返回 404，不做 SPA 回退
    if (path.extname(req.path)) {
      return res.status(404).end()
    }
    sendEmbeddedIndexHtml(res)
  })
} else {
  uiDistPath = process.env.UI_DIST_PATH ?? resolvePath('../ui/dist')
  app.use(express.static(uiDistPath))
  app.get('*', (req: Request, res: Response) => {
    if (req.path.startsWith('/api')) {
      return res.status(404).json({ error: 'API endpoint not found' })
    }
    // 有文件扩展名的静态资源请求找不到时返回 404，不做 SPA 回退
    if (path.extname(req.path)) {
      return res.status(404).end()
    }
    res.sendFile(path.join(uiDistPath!, 'index.html'))
  })
}

app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  if (err?.code === 'ECONNABORTED') return
  logger.error({ err }, 'Server error')
  reportSystemError({
    type: 'express_error',
    message: err instanceof Error ? err.message : String(err),
    stack: err instanceof Error ? err.stack : undefined,
  })
  if (res.headersSent) return
  return error(
    res,
    ResponseCodes.DEFAULT_ERROR,
    err.message || 'Internal server error'
  )
})

// ─── System-level error reporters ─────────────────────────────────────────────
process.on('uncaughtException', (err: Error) => {
  logger.error({ err }, 'uncaughtException')
  reportSystemError({
    type: 'uncaughtException',
    message: err.message,
    stack: err.stack,
    name: err.name,
  })
})

process.on('unhandledRejection', (reason: unknown) => {
  const err = reason instanceof Error ? reason : new Error(String(reason))
  logger.error({ err }, 'unhandledRejection')
  reportSystemError({
    type: 'unhandledRejection',
    message: err.message,
    stack: err.stack,
  })
})

// 优雅退出：Docker stop / sudo reboot 时收到 SIGTERM/SIGINT，关闭数据库后再退出
// 避免 WAL 文件残留导致下次启动时数据库损坏
async function gracefulShutdown(signal: string): Promise<void> {
  logger.info({ signal }, 'Received shutdown signal, closing databases...')
  try {
    const { closeBrowserRunner } = await import('./workflow/browserRunner.js')
    await closeBrowserRunner()
  } catch {}
  try {
    const { closeSharedDb } = await import('./storage/sqlite.js')
    closeSharedDb()
  } catch {}
  try {
    const { closeChunksDb, closeEmbeddingDbs } =
      await import('./storage/sqlite/store/chunk.js')
    closeChunksDb()
    closeEmbeddingDbs()
  } catch {}
  logger.info('Databases closed, exiting.')
  process.exit(0)
}

process.once('SIGTERM', () => gracefulShutdown('SIGTERM'))
process.once('SIGINT', () => gracefulShutdown('SIGINT'))

async function startServer() {
  try {
    const uploadsPath = config.upload.local.path
    if (!fs.existsSync(uploadsPath)) {
      fs.mkdirSync(uploadsPath, { recursive: true })
      logger.info({ uploadsPath }, 'Created uploads directory')
    }

    const publicPath = path.join(config.dataPath, 'public')
    if (!fs.existsSync(publicPath)) {
      fs.mkdirSync(publicPath, { recursive: true })
      logger.info({ publicPath }, 'Created public directory')
    }

    // 构建时 sourcemap 状态（见 scripts/build.ts）
    const { BUILD_SOURCEMAP_ENABLED } =
      await import('./generated/buildSourcemap.js')
    if (BUILD_SOURCEMAP_ENABLED) {
      logger.info('sourcemap enabled')
    }

    const { createServer } = await import('http')
    const httpServer = createServer(app)

    // AUTO_TEST_MODE: 真实 LLM 调用耗时较长，放开所有请求超时限制
    if (process.env.AUTO_TEST_MODE === '1') {
      httpServer.requestTimeout = 0
      httpServer.headersTimeout = 0
      httpServer.timeout = 0
    }

    const { wsService } = await import('./websocket/index.js')
    await wsService.initialize(httpServer)

    // Start listening immediately so the UI proxy doesn't get ECONNREFUSED
    // during the (potentially slow) initialization phase.
    logger.info({ port: PORT }, 'Starting HTTP server...')
    await new Promise<void>((resolve, reject) => {
      const onError = (err: Error) => {
        logger.error({ err, port: PORT }, 'HTTP server failed to listen')
        reject(err)
      }
      httpServer.once('error', onError)
      httpServer.listen(PORT, () => {
        httpServer.removeListener('error', onError)
        logger.info({ port: PORT }, 'HTTP server listening (initializing...)')
        resolve()
      })
    })

    // Heavy initialization runs after the port is already open
    await initDatabase()
    if (!APP_TYPE || APP_TYPE === 'claw') {
      const { useClaw } = await import('../../backend-claw/src/index.js')
      const { initClaw } = useClaw()
      await initClaw()
    }












    // Start the automatic database backup scheduler (no-op when backup.enable = false)
    const { initBackupScheduler } = await import('./utils/backup.js')
    initBackupScheduler()

    setServerReady(true)

    logger.info(
      {
        port: PORT,
        uiPath: uiDistPath,
        uploadsPath,
        apiUrl: `http://localhost:${PORT}/api`,
        wsUrl: `ws://localhost:${PORT}/api/websocket`,
      },
      'Server started successfully'
    )

    // 服务启动通知
    try {
      const { getSetting } = await import('./utils/setting.js')
      const startupNoticeEnable = await getSetting('startup_notice_enable', '0')
      if (startupNoticeEnable === '1') {
        const { broadcastNoticeAll } = await import('./utils/notice.js')
        const { AppConfig } = await import('./config.js')
        await broadcastNoticeAll(
          `🚀 服务已启动`,
          `**${AppConfig.title}** 已成功启动并准备就绪。\n\n- **启动时间：** ${getLocalTimeStr()}\n- **服务端口：** ${PORT}`
        ).catch((e) => logger.warn({ e }, 'Startup notice failed'))
      }
    } catch (e) {
      logger.warn({ e }, 'Failed to send startup notice')
    }

    // 登录通知监听
    {
      const { eventBus } = await import('./event/eventBus.js')
      eventBus.on('login:success', async ({ userId, username }) => {
        try {
          const { getSetting } = await import('./utils/setting.js')
          const loginNoticeEnable = await getSetting('login_notice_enable', '0')
          if (loginNoticeEnable !== '1') return
          const { broadcastNoticeToDefault } = await import('./utils/notice.js')
          const { AppConfig } = await import('./config.js')
          const { config: appConfig } = await import('./config/index.js')
          await broadcastNoticeToDefault(
            userId,
            `🔐 登录通知`,
            `**${AppConfig.title}** 检测到账号 **${username}** 于 ${getLocalTimeStr()} 成功登录。`,
            appConfig.auth.tenantId
          ).catch((e) => logger.warn({ e }, 'Login notice failed'))
        } catch (e) {
          logger.warn({ e }, 'Failed to send login notice')
        }
      })
    }

    // 启动完成 60 秒后强制触发一次 GC，释放初始化阶段产生的临时对象
    setTimeout(() => {
      try {
        const gcFn = (globalThis as any).Bun?.gc
        if (typeof gcFn === 'function') {
          const before = process.memoryUsage().rss
          gcFn.call((globalThis as any).Bun, true)
          const after = process.memoryUsage().rss
          logger.info(
            {
              beforeMB: Math.round(before / 1024 / 1024),
              afterMB: Math.round(after / 1024 / 1024),
              freedMB: Math.round((before - after) / 1024 / 1024),
            },
            'Post-startup GC completed'
          )
        }
      } catch {
        // 非 Bun 运行时或 GC 不可用，忽略
      }
    }, 60_000)
  } catch (err) {
    logger.error(
      {
        error: err,
        message: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : undefined,
      },
      'Server startup failed'
    )
    console.error('Detailed error:', err)
    process.exit(1)
  }
}

startServer()
