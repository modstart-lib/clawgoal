import { getClawRuntimeWs } from '../index.js'
import { clawDb } from '../storage/store/index.js'
import type { RuntimeRow } from '../storage/store/index.js'
import type { IRuntimeController, SendRunRunnerOpts } from './controller.js'

/**
 * WS 远程运行环境控制器
 * 封装对 RuntimeWebsocketService 的调用，使其与 LocalRuntimeController 实现相同的 IRuntimeController 接口
 */
export class WsRuntimeController implements IRuntimeController {
  constructor(private readonly runtimeId: number) {}

  getRuntimeRow(): RuntimeRow {
    const row = clawDb.findRuntimeById(this.runtimeId)
    if (!row) throw new Error(`Runtime id=${this.runtimeId} not found`)
    return row
  }

  sendExecute(sessionId: string, opts: SendRunRunnerOpts): boolean {
    return getClawRuntimeWs().sendExecute(this.runtimeId, {
      sessionId,
      name: opts.name,
      prompt: opts.prompt,
      cwd: opts.cwd,
      sessionContinueId: opts.sessionContinueId,
    })
  }

  requestSync(): boolean {
    return getClawRuntimeWs().requestSync(this.runtimeId)
  }
}
