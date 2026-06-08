/**
 * ACP (Agent Communication Protocol) connector
 * Spec: https://agentcommunicationprotocol.dev/
 *
 * Communicates with ACP-compatible agent servers via HTTP REST API.
 * Supports both synchronous (POST /runs) and streaming (POST /runs/stream) modes.
 */

import { safeJsonParse } from '../../../backend/src/utils/json.js'
import { createNamedLogger } from '../../../backend/src/utils/logger.js'

const logger = createNamedLogger('connect')

export const name = 'acp'
export const title = 'ACP Agent'

export const DEFAULT_BASE_URL = 'http://localhost:8000'

export interface AcpAgent {
  name: string
  description?: string
  metadata?: Record<string, unknown>
}

export async function detect(baseUrl = DEFAULT_BASE_URL): Promise<boolean> {
  try {
    const res = await fetch(`${baseUrl}/agents`, {
      signal: AbortSignal.timeout(3000),
    })
    return res.ok
  } catch {
    return false
  }
}

export async function listAgents(
  baseUrl = DEFAULT_BASE_URL
): Promise<AcpAgent[]> {
  logger.debug(`[ACP] --> GET ${baseUrl}/agents`)
  const res = await fetch(`${baseUrl}/agents`, {
    signal: AbortSignal.timeout(5000),
  })
  if (!res.ok) throw new Error(`ACP GET /agents failed: ${res.status}`)
  // ACP spec: response may be { agents: [...] } or a bare array
  const data = (await res.json()) as { agents?: AcpAgent[] } | AcpAgent[]
  logger.debug(`[ACP] <-- GET /agents ${JSON.stringify(data)}`)
  if (Array.isArray(data)) return data
  return data.agents ?? []
}

export async function run(
  baseUrl: string,
  agentName: string,
  prompt: string,
  onChunk?: (text: string) => void
): Promise<string> {
  const body = JSON.stringify({
    agent_name: agentName,
    input: [
      {
        role: 'user',
        parts: [{ type: 'text', content: prompt }],
      },
    ],
  })

  if (onChunk) {
    return _runStream(baseUrl, body, onChunk)
  }
  return _runSync(baseUrl, body)
}

async function _runSync(baseUrl: string, body: string): Promise<string> {
  logger.debug(`[ACP] --> POST ${baseUrl}/runs ${body}`)
  const res = await fetch(`${baseUrl}/runs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    logger.debug(
      `[ACP] <-- POST /runs ERROR (${res.status}) ${text.slice(0, 200)}`
    )
    throw new Error(
      `ACP POST /runs failed (${res.status}): ${text.slice(0, 200)}`
    )
  }
  const data = (await res.json()) as {
    output?: Array<{
      role: string
      parts: Array<{ type: string; content: string }>
    }>
  }
  logger.debug(`[ACP] <-- POST /runs ${JSON.stringify(data)}`)
  return _extractText(data.output ?? [])
}

async function _runStream(
  baseUrl: string,
  body: string,
  onChunk: (text: string) => void
): Promise<string> {
  logger.debug(`[ACP] --> POST ${baseUrl}/runs/stream ${body}`)
  const res = await fetch(`${baseUrl}/runs/stream`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'text/event-stream',
    },
    body,
  })
  if (!res.ok || !res.body) {
    logger.debug(`[ACP] <-- POST /runs/stream ERROR (${res.status})`)
    throw new Error(`ACP POST /runs/stream failed: ${res.status}`)
  }
  logger.debug(`[ACP] <-- POST /runs/stream connected (${res.status})`)

  const collected: string[] = []
  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue
      const payload = safeJsonParse(line.slice(6), null, 'acp.payload') as {
        parts?: Array<{ type: string; content: string }>
        output?: Array<{ parts?: Array<{ type: string; content: string }> }>
      } | null
      if (!payload) continue
      logger.debug(`[ACP] <-- SSE ${line.slice(6)}`)
      // message_part event: { role, parts }
      if (payload.parts) {
        for (const part of payload.parts) {
          if (part.type === 'text' && part.content) {
            collected.push(part.content)
            onChunk(part.content)
          }
        }
      }
      // run_completed event: { status, output }
      if (payload.output) {
        for (const msg of payload.output) {
          for (const part of msg.parts ?? []) {
            if (part.type === 'text' && part.content) {
              collected.push(part.content)
            }
          }
        }
      }
    }
  }
  return collected.join('')
}

function _extractText(
  output: Array<{
    role: string
    parts: Array<{ type: string; content: string }>
  }>
): string {
  const parts: string[] = []
  for (const msg of output) {
    for (const part of msg.parts ?? []) {
      if (part.type === 'text') parts.push(part.content)
    }
  }
  return parts.join('')
}
