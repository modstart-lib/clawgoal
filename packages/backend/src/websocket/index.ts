/**
 * WebSocket service entry point
 *
 * Combines two independent channels:
 *   - ManageWebSocketService  /api/websocket/manage     Management side
 *   - BotWebSocketService     /api/websocket/extension  Browser extension side
 *
 * The common base class and auth logic are in base.ts (re-exported through this file).
 */
import { SystemWebsocketService } from './system.js'

export { BaseWebsocketService } from './base.js'

const APP_TYPE = process.env.APP_TYPE || ''

class WebSocketService {
  private system = new SystemWebsocketService()
  private clawWs: any = null

  async initialize(httpServer: any): Promise<void> {
    if (!APP_TYPE || APP_TYPE === 'claw') {
      const { useClawWebSocket, initClawSystemEvents } =
        await import('../../../backend-claw/src/index.js')
      this.clawWs = useClawWebSocket()
      this.clawWs.agent.initialize(httpServer)
      this.clawWs.runtime.initialize(httpServer)
      initClawSystemEvents(this.system)
    }
    this.system.initialize(httpServer)
  }

  /** Returns aggregated connection statistics. */
  getStats() {
    return {
      ...(this.clawWs
        ? { ...this.clawWs.node.getStats(), ...this.clawWs.agent.getStats() }
        : {}),
      ...this.system.getStats(),
    }
  }

  /** Broadcast an event to all authenticated system WebSocket clients. */
  broadcastSystemEvent(name: string, data?: Record<string, unknown>): void {
    this.system.broadcastEvent(name, data)
  }

}

export const wsService = new WebSocketService()
