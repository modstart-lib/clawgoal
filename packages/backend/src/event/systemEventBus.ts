import { EventEmitter } from 'events'

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export type SystemEventMap = {}

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

export const systemEventBus = new SystemEventBus()
