type EventMap = {
  'remoteUser:openLogin': { page?: string }
  'remoteUser:updated': Record<string, never>
}

type EventHandler<T> = (payload: T) => void

const listeners = new Map<string, Set<EventHandler<any>>>()

function on<K extends keyof EventMap>(
  event: K,
  handler: EventHandler<EventMap[K]>
): () => void {
  if (!listeners.has(event)) listeners.set(event, new Set())
  listeners.get(event)!.add(handler)
  return () => off(event, handler)
}

function off<K extends keyof EventMap>(
  event: K,
  handler: EventHandler<EventMap[K]>
): void {
  listeners.get(event)?.delete(handler)
}

function emit<K extends keyof EventMap>(event: K, payload: EventMap[K]): void {
  listeners.get(event)?.forEach((h) => h(payload))
}

export const eventBus = { on, off, emit }
