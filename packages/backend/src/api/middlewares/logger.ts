/**
 * HTTP 请求日志中间件
 */
import { NextFunction, Request, Response } from 'express'
import { createNamedLogger } from '../../utils/logger.js'

const logger = createNamedLogger('http')

/**
 * 记录 HTTP 请求
 */
export function httpLogger(req: Request, res: Response, next: NextFunction) {
  const startTime = Date.now()

  logger.info(
    {
      method: req.method,
      url: req.url,
      ip: req.ip,
      userAgent: req.get('user-agent'),
    },
    'Request received'
  )

  res.on('finish', () => {
    const duration = Date.now() - startTime
    const logLevel = res.statusCode >= 400 ? 'warn' : 'info'

    logger[logLevel](
      {
        method: req.method,
        url: req.url,
        statusCode: res.statusCode,
        duration: `${duration}ms`,
      },
      'Request completed'
    )
  })

  next()
}
