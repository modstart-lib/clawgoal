const DEFAULT_API_BASE = '/api'

const GLOBAL_API_BASE_KEY = '__ClawGoal_API_BASE__'

type ApiBaseGlobal = typeof globalThis & {
  [GLOBAL_API_BASE_KEY]?: string
}

function getGlobalApiBase(): string | undefined {
  return (globalThis as ApiBaseGlobal)[GLOBAL_API_BASE_KEY]
}

function setGlobalApiBase(apiBase: string): void {
  ;(globalThis as ApiBaseGlobal)[GLOBAL_API_BASE_KEY] = apiBase
}

let currentApiBase = getGlobalApiBase() || DEFAULT_API_BASE

function normalizeApiBase(apiBase: string): string {
  const trimmed = apiBase.trim()
  if (!trimmed) {
    return DEFAULT_API_BASE
  }
  return trimmed.endsWith('/') ? trimmed.slice(0, -1) : trimmed
}

export function setApiBase(apiBase: string): void {
  currentApiBase = normalizeApiBase(apiBase)
  setGlobalApiBase(currentApiBase)
}

export function getApiBase(): string {
  return currentApiBase
}

export function resolveApiPath(path: string): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  return `${currentApiBase}${normalizedPath}`
}
