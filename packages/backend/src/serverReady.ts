let serverReady = false

export function setServerReady(ready: boolean): void {
  serverReady = ready
}

export function isServerReady(): boolean {
  return serverReady
}
