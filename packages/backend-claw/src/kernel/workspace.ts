import fs from 'node:fs/promises'
import path from 'node:path'
import { config } from '../../../backend/src/config'
import type { Agent } from '../types'

export async function getAgentWorkspacePath(param: {
  agent?: Agent
  agentId?: number
  dir?: string
}): Promise<string> {
  const id = String(param.agent?.id ?? param.agentId ?? '0')
  const parts: string[] = [config.dataPath, 'agentWorkspaces', id]
  if (param.dir) parts.push(param.dir)
  const dirPath = path.join(...parts)
  await fs.mkdir(dirPath, { recursive: true }).catch(() => {})
  return dirPath
}
