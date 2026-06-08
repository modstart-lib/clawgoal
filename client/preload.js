const { contextBridge, ipcRenderer } = require('electron')

/**
 * Unified API bridge between renderer and main process.
 *
 * window.__api.call(name, ...args)
 *   → ipcRenderer.invoke('api-call', name, args)
 *   → main process handles via switch(name)
 *   → returns result
 *
 * window.__api.eval(name, handler)
 *   → registers a handler for main→renderer calls
 *   → main process sends ipcRenderer.send('api-eval', { name, args })
 *   → handler(args) is called
 */
const evalHandlers = {}

ipcRenderer.on('api-eval', (_event, { name, args }) => {
  const handler = evalHandlers[name]
  if (handler) handler(...args)
})

contextBridge.exposeInMainWorld('__api', {
  platform: process.platform,
  call: (name, ...args) => ipcRenderer.invoke('api-call', name, args).catch(err => {
    console.error(`[preload] api-call '${name}' failed:`, err.message)
  }),

  eval: (name, handler) => {
    evalHandlers[name] = handler
  },
})
