import type pino from 'pino'
import type { RuntimeRow } from '../storage/store/index.js'
import type { RunRunnerEvent } from '../websocket/runtime.js'

export interface SendRunRunnerOpts {
  /** runner name */
  name: string
  prompt: string
  cwd?: string
  sessionContinueId?: string
  /** agent 专属日志记录器，用于将 ACP-STDIO 通信记录同步写入 logs/agent/ */
  agentLogger?: pino.Logger
}

export interface IRuntimeController {
  /** 返回当前运行环境的 RuntimeRow（含已序列化的 runners JSON 字符串） */
  getRuntimeRow(
    tenantId: number,
    userId: number
  ): RuntimeRow | Promise<RuntimeRow>
  /**
   * 下发 runRunner 任务。
   * 本机运行环境：直接异步调用 runRunnerTool()，通过 runtimeWs.emitSessionEvent() 注入事件流。
   * WS 运行环境：通过 socket.io 向远端 runtime 发送 runRunner 事件。
   * @returns true=任务已下发，false=无法下发（运行环境不在线）
   */
  sendExecute(
    sessionId: string,
    opts: SendRunRunnerOpts
  ): boolean | Promise<boolean>
  /** 请求重新同步 runner 列表 */
  requestSync(tenantId: number, userId: number): boolean | Promise<boolean>
}

export type { RunRunnerEvent }
