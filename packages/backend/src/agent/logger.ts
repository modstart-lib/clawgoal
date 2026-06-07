/**
 * Agent task logger factory
 * Provides a unified pino logger creation method with simultaneous output to console and log file
 */
import fs from 'fs'
import path from 'path'
import pino from 'pino'
import { config } from '../config'
import { logger } from '../utils/logger.js'
import type { AgentExecutor } from './agentExecutor.js'

/**
 * Create a named pino logger for AgentExecutor
 * In development, writes to both pino-pretty console and a file; in production, writes to file only
 *
 * @param executor   AgentExecutor instance (reads logDir from it)
 * @param name       Log file name (without extension), e.g., 'executor' / 'task' / 'log'
 * @returns          pino.Logger instance
 */
export function createAgentLogger(
  executor: AgentExecutor,
  name: string
): pino.Logger {
  const taskLogDir = executor.logDir
  try {
    if (!fs.existsSync(taskLogDir)) {
      fs.mkdirSync(taskLogDir, { recursive: true })
    }
    const logFilePath = path.join(taskLogDir, `${name}.log`)
    const logStream = fs.createWriteStream(logFilePath, { flags: 'a' })
    const isDev = process.env.NODE_ENV === 'development'
    if (isDev) {
      return pino(
        {
          level: 'debug',
          timestamp: pino.stdTimeFunctions.isoTime,
          // errorKey 设为 'pinoErr'：防止 pino-pretty 将 'err' 追加到 errorLikeObjectKeys
          errorKey: 'pinoErr',
        },
        pino.multistream([
          {
            level: 'debug',
            stream: pino.transport({
              target: 'pino-pretty',
              options: {
                colorize: true,
                translateTime: 'yyyy-mm-dd HH:MM:ss',
                ignore: 'pid,hostname',
                singleLine: true,
                errorLikeObjectKeys: [],
              },
            }),
          },
          {
            level: 'debug',
            stream: logStream,
          },
        ])
      )
    } else {
      return pino(
        {
          level: 'info',
          timestamp: pino.stdTimeFunctions.isoTime,
          errorKey: 'pinoErr',
        },
        logStream
      )
    }
  } catch (error) {
    logger.error(
      { taskLogDir, name, error },
      'Failed to create task logger, using global logger'
    )
    return logger
  }
}

/**
 * Create a named pino logger from a taskId (without requiring a full AgentExecutor instance)
 * Constructs a minimal object containing only logDir, then delegates to createAgentLogger.
 *
 * @param taskId   Task ID (string or number)
 * @param name     Log file name (without extension), e.g., 'websocket' / 'executor'
 * @returns        pino.Logger instance
 */
export function createAgentLoggerFromTaskId(
  taskId: string | number,
  name: string
): pino.Logger {
  const fakeExecutor = {
    logDir: path.resolve(config.agentTask.path, taskId.toString(), 'logs'),
  } as unknown as AgentExecutor
  return createAgentLogger(fakeExecutor, name)
}
