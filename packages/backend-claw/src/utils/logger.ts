import path from 'path'
import { config } from '../../../backend/src/config/index.js'
import {
  createCachedFileLogger,
  releaseCachedFileLogger,
} from '../../../backend/src/utils/logger.js'

function makeKey(id: string | number, sessionId: string): string {
  return `agent:${id}:${sessionId}`
}

// 记录本模块创建的 key，用于 releaseAllAgentLoggers 精确回收
const _agentKeys = new Set<string>()

/**
 * 获取 agent 专属 logger。
 * 日志写入 logPath/agent/<id>/<sessionId>.log，
 * 控制台输出复用共享 prettyStream。
 * 30分钟无请求则由共享缓存自动关闭文件流并回收。
 */
export function getAgentLogger(
  agent: string,
  id: string | number,
  sessionId: string
) {
  const key = makeKey(id, sessionId)
  const filePath = path.join(
    config.logPath,
    'agent',
    String(id),
    `${sessionId}.log`
  )
  _agentKeys.add(key)
  return createCachedFileLogger(key, filePath)
}

/**
 * 手动释放指定 agent 的日志连接。
 */
export function releaseAgentLogger(
  agent: string,
  id: string | number,
  sessionId: string
): void {
  const key = makeKey(id, sessionId)
  _agentKeys.delete(key)
  releaseCachedFileLogger(key)
}

/**
 * 释放所有 agent 日志连接（服务关闭时调用）。
 */
export function releaseAllAgentLoggers(): void {
  for (const key of _agentKeys) releaseCachedFileLogger(key)
  _agentKeys.clear()
}
