import { EventEmitter } from 'events'

export type SystemEventMap = {
  'login:success': { userId: number; username: string; token: string }
  'login:failure': { username: string; reason: string }
}

type EventListener<T> = (payload: T) => void | Promise<void>

class SystemEventBus {
  private emitter = new EventEmitter()

  on<K extends keyof SystemEventMap>(
    event: K,
    listener: EventListener<SystemEventMap[K]>
  ): void {
    this.emitter.on(event, listener)
  }

  off<K extends keyof SystemEventMap>(
    event: K,
    listener: EventListener<SystemEventMap[K]>
  ): void {
    this.emitter.off(event, listener)
  }

  emit<K extends keyof SystemEventMap>(
    event: K,
    payload: SystemEventMap[K]
  ): void {
    this.emitter.emit(event, payload)
  }
}

export const eventBus = new SystemEventBus()
