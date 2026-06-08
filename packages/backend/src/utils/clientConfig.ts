/**
 * Client config file (~/.clawgoal/client.json) read/write utilities.
 * Central store for dataPath, UUID, backendPid, and other client-wide state.
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { safeJsonParse } from './json.js'

export interface ClientConfig {
  dataPath?: string
  uuid?: string
  backendPid?: number
}

function getClientConfigPath(): string {
  return path.join(os.homedir(), '.clawgoal', 'client.json')
}

export function loadClientConfig(): ClientConfig | null {
  const p = getClientConfigPath()
  try {
    const data = fs.readFileSync(p, 'utf-8')
    return safeJsonParse(data, null, 'clientConfig')
  } catch {
    return null
  }
}

export function saveClientConfig(cfg: ClientConfig): void {
  const p = getClientConfigPath()
  fs.mkdirSync(path.dirname(p), { recursive: true })
  fs.writeFileSync(p, JSON.stringify(cfg, null, 2), 'utf-8')
}

/** Merge partial fields into existing config. */
export function updateClientConfig(partial: Partial<ClientConfig>): void {
  const existing = loadClientConfig() || {}
  saveClientConfig({ ...existing, ...partial })
}
