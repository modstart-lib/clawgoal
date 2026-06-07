const { app, BrowserWindow, ipcMain, dialog, shell, Menu, screen } = require('electron')
const path = require('path')
const { spawn, exec } = require('child_process')
const fs = require('fs')
const http = require('http')
const net = require('net')

// ─── Logging to ~/.clawgoal/logs/YYYYMMDD.log ─────────────────────────────────
const LOG_DIR = path.join(require('os').homedir(), '.clawgoal', 'logs')

function logFilePath() {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return path.join(LOG_DIR, `${y}${m}${day}.log`)
}

function ensureLogDir() {
  if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true })
  }
}

function logToFile(level, msg) {
  try {
    ensureLogDir()
    const ts = new Date().toISOString()
    fs.appendFileSync(logFilePath(), `[${ts}] [${level}] ${msg}\n`)
  } catch { /* ignore write errors */ }
}

// Override console methods to also write to log file
const origLog = console.log
const origError = console.error
const origWarn = console.warn

console.log = function (...args) {
  const msg = args.map(a => typeof a === 'string' ? a : JSON.stringify(a)).join(' ')
  logToFile('INFO', msg)
  origLog.apply(console, args)
}

console.error = function (...args) {
  const msg = args.map(a => typeof a === 'string' ? a : JSON.stringify(a)).join(' ')
  logToFile('ERROR', msg)
  origError.apply(console, args)
}

console.warn = function (...args) {
  const msg = args.map(a => typeof a === 'string' ? a : JSON.stringify(a)).join(' ')
  logToFile('WARN', msg)
  origWarn.apply(console, args)
}

// ─── Constants ────────────────────────────────────────────────────────────────
const BINARY_NAME = process.platform === 'win32' ? 'clawgoal.exe' : 'clawgoal'
const POLL_INTERVAL = 500
const POLL_TIMEOUT = 60000

// ─── State ────────────────────────────────────────────────────────────────────
let splashWin = null   // splash / setup window
let appWin = null      // actual app window (created after backend is ready)
let serverProcess = null
let serverPort = 0
let frontendReady = false
let pendingEvents = []

// ─── PID management (in ~/.clawgoal/client.json) ─────────────────────────────

/** Kill backend process recorded in client.json, then remove it. */
function killPreviousBackend() {
  const cfg = loadClientConfig()
  if (cfg && cfg.backendPid > 0) {
    try {
      process.kill(cfg.backendPid, 'SIGTERM')
      console.log(`[pid] Killed previous backend process ${cfg.backendPid}`)
    } catch { /* process already dead */ }
  }
}

/** Save current backend PID to client.json. */
function saveBackendPid(pid) {
  saveClientConfig({ backendPid: pid })
  console.log(`[pid] Saved backend PID ${pid}`)
}

/** Remove the PID from client.json. Called on clean shutdown. */
function removePidFile() {
  const existing = loadClientConfig()
  if (existing) {
    delete existing.backendPid
    saveClientConfig(existing)
  }
}

// ─── Backend binary path ──────────────────────────────────────────────────────
function getBackendBinaryPath() {
  const isDev = !app.isPackaged
  if (isDev) {
    return path.join(__dirname, 'backend', BINARY_NAME)
  }
  return path.join(process.resourcesPath, 'backend', BINARY_NAME)
}

// ─── Find available port ──────────────────────────────────────────────────────
function findAvailablePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer()
    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port
      server.close(() => resolve(port))
    })
    server.on('error', reject)
  })
}

// ─── Client config management ─────────────────────────────────────────────────
function clientConfigPath() {
  const home = require('os').homedir()
  const dir = path.join(home, '.clawgoal')
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
  return path.join(dir, 'client.json')
}

function loadClientConfig() {
  try {
    const data = fs.readFileSync(clientConfigPath(), 'utf-8')
    return JSON.parse(data)
  } catch {
    return null
  }
}

function saveClientConfig(cfg) {
  const existing = loadClientConfig() || {}
  const merged = { ...existing, ...cfg }
  fs.writeFileSync(clientConfigPath(), JSON.stringify(merged, null, 2), 'utf-8')
}

function defaultDataPath() {
  const home = require('os').homedir()
  return path.join(home, '.clawgoal', 'data')
}

// ─── Send event to splash renderer (via unified api-eval channel) ─────────────
function sendToRenderer(name, data) {
  const target = splashWin && !splashWin.isDestroyed() ? splashWin.webContents : null
  if (target) {
    const msg = { name, args: [data] }
    if (frontendReady) {
      target.send('api-eval', msg)
    } else {
      pendingEvents.push(msg)
    }
  }
}

// ─── Wait for server readiness ────────────────────────────────────────────────
function waitForServer(baseURL, timeout) {
  return new Promise((resolve, reject) => {
    const deadline = Date.now() + timeout
    const ping = () => {
      if (Date.now() > deadline) {
        reject(new Error(`Server at ${baseURL} did not respond within ${timeout}ms`))
        return
      }
      const req = http.request(`${baseURL}/api/ping`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        timeout: 3000
      }, (res) => {
        res.resume()
        if (res.statusCode < 500) {
          resolve()
        } else {
          setTimeout(ping, POLL_INTERVAL)
        }
      })
      req.on('error', () => setTimeout(ping, POLL_INTERVAL))
      req.write('{}')
      req.end()
    }
    ping()
  })
}

// ─── Start backend server ─────────────────────────────────────────────────────
async function startBackendServer() {
  // Kill any leftover backend from a previous session
  killPreviousBackend()

  const binaryPath = getBackendBinaryPath()
  if (!fs.existsSync(binaryPath)) {
    sendToRenderer('server-error', `找不到后端程序: ${binaryPath}`)
    console.error(`Backend binary not found at: ${binaryPath}`)
    return
  }
  console.log(`Using bundled binary: ${binaryPath}`)

  try {
    serverPort = await findAvailablePort()
  } catch (err) {
    sendToRenderer('server-error', `无法找到可用端口: ${err.message}`)
    return
  }
  console.log(`Using port ${serverPort} for backend server`)

  // Check client config
  const clientCfg = loadClientConfig()
  if (!clientCfg || !clientCfg.dataPath) {
    console.log('~/.clawgoal/client.json not found or incomplete, showing setup wizard')
    sendToRenderer('server-setup', defaultDataPath())
    return
  }

  const configYaml = path.join(clientCfg.dataPath, 'config.yaml')
  if (!fs.existsSync(configYaml)) {
    console.log(`config.yaml not found at ${configYaml}, showing setup wizard`)
    sendToRenderer('server-setup', defaultDataPath())
    return
  }

  launchServe(buildBaseEnv(clientCfg.dataPath))
}

function buildBaseEnv(dataPath) {
  const env = Object.assign({}, process.env, {
    PORT: String(serverPort),
    IS_CLIENT: '1'
  })
  if (dataPath) {
    env.DATA_PATH = dataPath
  }
  return env
}

function launchServe(env) {
  const homeDir = path.join(require('os').homedir(), '.clawgoal')
  if (!fs.existsSync(homeDir)) {
    fs.mkdirSync(homeDir, { recursive: true })
  }

  const binaryPath = getBackendBinaryPath()
  console.log(`Starting backend server from: ${binaryPath}`)
  sendToRenderer('server-status', '正在启动服务...')

  serverProcess = spawn(binaryPath, ['serve'], {
    cwd: homeDir,
    env: env,
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: true // Own process group for clean kill of sub-processes
  })

  // Save PID for lifecycle management
  saveBackendPid(serverProcess.pid)

  serverProcess.stdout.on('data', (data) => {
    console.log(`[backend] ${data.toString().trim()}`)
  })

  serverProcess.stderr.on('data', (data) => {
    console.error(`[backend-err] ${data.toString().trim()}`)
  })

  serverProcess.on('error', (err) => {
    console.error(`Failed to start backend: ${err.message}`)
    sendToRenderer('server-error', `启动服务失败: ${err.message}`)
  })

  serverProcess.on('exit', (code) => {
    console.log(`Backend process exited with code ${code}`)
    serverProcess = null
    removePidFile()
  })

  console.log(`Backend process started (PID: ${serverProcess.pid}), waiting for server...`)
  sendToRenderer('server-status', '等待服务就绪...')

  const serverURL = `http://localhost:${serverPort}`
  waitForServer(serverURL, POLL_TIMEOUT)
    .then(() => {
      console.log('Backend server is ready! App URL:', serverURL)
      // Create app window (hidden until Vue mounts on #app)
      createAppWindow(serverURL)
      // Notify splash to show "ready" status
      sendToRenderer('server-ready', serverURL)
      // Splash will be hidden when app DOM is fully rendered (inside createAppWindow)
    })
    .catch((err) => {
      console.error(`Server did not become ready: ${err.message}`)
      sendToRenderer('server-error', `服务启动超时: ${err.message}`)
    })
}

function runInitCommand(env) {
  return new Promise((resolve, reject) => {
    const binaryPath = getBackendBinaryPath()
    const homeDir = path.join(require('os').homedir(), '.clawgoal')
    console.log(`Running init command: ${binaryPath} init`)
    const cmd = spawn(binaryPath, ['init'], {
      cwd: homeDir,
      env: env,
      stdio: ['ignore', 'pipe', 'pipe']
    })
    cmd.on('close', (code) => {
      if (code === 0) resolve()
      else reject(new Error(`init command failed with code ${code}`))
    })
    cmd.on('error', reject)
  })
}

// ─── Unified IPC handler ──────────────────────────────────────────────────────
function setupIPC() {
  // Unified renderer→main call: window.__api.call(name, ...args)
  ipcMain.handle('api-call', async (_, name, args) => {
    switch (name) {
      case 'openUrl':
        if (args[0]) shell.openExternal(args[0])
        return

      case 'toggleDevTools': {
        const win = appWin || splashWin
        if (win) {
          if (win.webContents.isDevToolsOpened()) {
            win.webContents.closeDevTools()
          } else {
            win.webContents.openDevTools({ mode: 'detach' })
          }
        }
        return
      }

      case 'selectDirectory': {
        const result = await dialog.showOpenDialog(splashWin, {
          properties: ['openDirectory'],
          title: '选择数据目录'
        })
        return result.canceled ? '' : result.filePaths[0]
      }

      case 'startInstall': {
        const { username, password, dataPath } = args[0] || {}
        sendToRenderer('server-status', '正在初始化配置...')
        saveClientConfig({ dataPath })
        const env = buildBaseEnv(dataPath)
        env.INIT_USERNAME = username
        env.INIT_PASSWORD = password
        env.INIT_DATA_PATH = dataPath
        try {
          await runInitCommand(env)
          launchServe(buildBaseEnv(dataPath))
        } catch (err) {
          sendToRenderer('server-error', `初始化失败: ${err.message}`)
        }
        return
      }

      case 'startRestore': {
        const dataPath = args[0]
        sendToRenderer('server-status', '正在加载数据...')
        saveClientConfig({ dataPath })
        launchServe(buildBaseEnv(dataPath))
        return
      }

      case 'minimize':
        if (splashWin) splashWin.minimize()
        return

      case 'maximize':
        if (splashWin) {
          splashWin.isMaximized() ? splashWin.unmaximize() : splashWin.maximize()
        }
        return

      case 'close':
        if (splashWin) splashWin.close()
        return

      case 'isMaximized':
        return splashWin ? splashWin.isMaximized() : false

      case 'frontendReady':
        frontendReady = true
        // Flush pending events to splashWin
        for (const evt of pendingEvents) {
          if (splashWin && !splashWin.isDestroyed()) {
            splashWin.webContents.send('api-eval', evt)
          }
        }
        pendingEvents = []
        // Start backend (non-blocking)
        startBackendServer().catch(err => {
          console.error('Failed to start backend:', err)
        })
        return

      default:
        console.warn(`[main] Unknown api-call: ${name}`)
    }
  })
}

// ─── Wait for Vue app DOM to be fully rendered ────────────────────────────────
function waitForDomReady(webContents, timeout = 15000) {
  return new Promise((resolve, reject) => {
    const deadline = Date.now() + timeout
    const poll = () => {
      if (Date.now() > deadline) {
        reject(new Error(`DOM not ready within ${timeout}ms`))
        return
      }
      if (webContents.isDestroyed()) {
        reject(new Error('WebContents destroyed'))
        return
      }
      webContents.executeJavaScript(`
        (function() {
          var el = document.querySelector('#app');
          // Vue sets __vue_app__ on root element after mount; fallback to children
          return !!(el && (el.__vue_app__ || (el.children && el.children.length > 0)));
        })()
      `).then(ready => {
        if (ready) {
          resolve()
        } else {
          setTimeout(poll, 100)
        }
      }).catch(() => {
        // Page may be mid-transition, retry
        setTimeout(poll, 200)
      })
    }
    poll()
  })
}

// ─── Create splash window (small, frameless, loading + setup) ─────────────────
function createSplashWindow() {
  const isMac = process.platform === 'darwin'

  splashWin = new BrowserWindow({
    width: 700,
    height: 500,
    center: true,
    minWidth: 700,
    minHeight: 500,
    title: 'ClawGoal',
    icon: path.join(__dirname, 'build', 'appicon.png'),
    titleBarStyle: isMac ? 'hiddenInset' : 'default',
    frame: !isMac ? false : undefined,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    },
    show: false
  })

  splashWin.setMenuBarVisibility(false)

  splashWin.once('ready-to-show', () => {
    splashWin.show()
  })

  splashWin.loadFile(path.join(__dirname, 'frontend', 'splash.html'))

  splashWin.on('closed', () => {
    splashWin = null
  })

  captureRendererConsole(splashWin)
  setupContextMenu(splashWin)
}

// ─── Capture renderer console messages to Electron log ──────────────────────
function captureRendererConsole(win) {
  if (!win || win.isDestroyed()) return
  win.webContents.on('console-message', (_event, level, message) => {
    const levelName = ['verbose', 'info', 'warn', 'error'][level] || 'info'
    console.log(`[renderer:${levelName}] ${message}`)
  })
}

// ─── Create app window (full size, loads backend URL) ─────────────────────────
function createAppWindow(url) {
  if (appWin && !appWin.isDestroyed()) return
  const isMac = process.platform === 'darwin'

  const primaryDisplay = screen.getPrimaryDisplay()
  const workArea = primaryDisplay.workAreaSize
  const defaultWidth = Math.min(1280, workArea.width)
  const defaultHeight = Math.min(800, workArea.height)

  appWin = new BrowserWindow({
    width: defaultWidth,
    height: defaultHeight,
    center: true,
    minWidth: 700,
    minHeight: 500,
    title: 'ClawGoal',
    icon: path.join(__dirname, 'build', 'appicon.png'),
    titleBarStyle: isMac ? 'hiddenInset' : 'default',
    frame: !isMac ? false : undefined,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    },
    show: false
  })

  appWin.setMenuBarVisibility(false)
  captureRendererConsole(appWin)

  // Wait for Vue app to fully mount on #app before revealing the window
  appWin.webContents.once('did-finish-load', () => {
    console.log('[app] Page loaded, waiting for Vue to mount...')
    waitForDomReady(appWin.webContents, 15000)
      .then(() => {
        console.log('[app] Vue app mounted, showing window')
        if (!appWin || appWin.isDestroyed()) return
        appWin.show()
        appWin.focus()
        hideSplashWindow()
      })
      .catch(err => {
        console.warn(`[app] DOM ready check failed, showing window anyway: ${err.message}`)
        if (appWin && !appWin.isDestroyed()) {
          appWin.show()
          appWin.focus()
        }
        hideSplashWindow()
      })
  })

  // Handle main-frame load failure — show window so user can see the error
  appWin.webContents.on('did-fail-load', (_event, errorCode, errorDesc, _url, isMainFrame) => {
    if (isMainFrame && appWin && !appWin.isDestroyed()) {
      console.error(`[app] Main frame load failed: ${errorDesc} (code: ${errorCode})`)
      appWin.show()
      hideSplashWindow()
    }
  })

  appWin.loadURL(url)

  // Forward maximize/unmaximize to renderer
  appWin.on('maximize', () => {
    appWin.webContents.send('api-eval', { name: 'maximize-change', args: [true] })
  })
  appWin.on('unmaximize', () => {
    appWin.webContents.send('api-eval', { name: 'maximize-change', args: [false] })
  })

  appWin.on('closed', () => {
    appWin = null
  })

  setupContextMenu(appWin)
}

// ─── Fade out and close splash window ─────────────────────────────────────────
function hideSplashWindow() {
  if (!splashWin || splashWin.isDestroyed()) return

  // CSS fade-out
  splashWin.webContents.executeJavaScript(`
    document.getElementById('splashContainer').style.transition = 'opacity 0.4s ease-out';
    document.getElementById('splashContainer').style.opacity = '0';
  `).catch(() => {})

  setTimeout(() => {
    if (splashWin && !splashWin.isDestroyed()) {
      splashWin.close()
      splashWin = null
    }
  }, 500)
}

// ─── Shared right-click context menu for text editing ─────────────────────────
function setupContextMenu(win) {
  win.webContents.on('context-menu', (event, params) => {
    const { editFlags, isEditable, selectionText } = params
    const hasSelection = selectionText && selectionText.trim().length > 0

    const template = []

    if (isEditable) {
      if (editFlags.canUndo) template.push({ role: 'undo' })
      if (editFlags.canRedo) template.push({ role: 'redo' })
      if (template.length > 0) template.push({ type: 'separator' })
      template.push({ role: 'cut', enabled: editFlags.canCut !== false })
      template.push({ role: 'copy', enabled: editFlags.canCopy !== false })
      template.push({ role: 'paste', enabled: editFlags.canPaste !== false })
      template.push({ type: 'separator' })
      template.push({ role: 'selectAll' })
    } else if (hasSelection) {
      template.push({ role: 'copy' })
      template.push({ role: 'selectAll' })
    }

    if (template.length > 0) {
      event.preventDefault()
      Menu.buildFromTemplate(template).popup({ window: win })
    }
  })
}

// ─── Application menu with Edit submenu (cut/copy/paste/selectAll) ────────────
function buildAppMenu() {
  const isMac = process.platform === 'darwin'

  // Edit submenu — enables Cmd+C/Cmd+V/Cmd+X/Cmd+A etc.
  const editSubmenu = [
    { role: 'undo' },
    { role: 'redo' },
    { type: 'separator' },
    { role: 'cut' },
    { role: 'copy' },
    { role: 'paste' },
    { type: 'separator' },
    { role: 'selectAll' },
  ]

  if (isMac) {
    editSubmenu.push(
      { type: 'separator' },
      { role: 'startSpeaking' },
      { role: 'stopSpeaking' }
    )
  }

  if (isMac) {
    const appMenu = Menu.buildFromTemplate([
      {
        label: app.getName(),
        submenu: [
          { role: 'about' },
          { type: 'separator' },
          { role: 'hide' },
          { role: 'hideOthers' },
          { type: 'separator' },
          { role: 'quit' },
        ],
      },
      { label: 'Edit', submenu: editSubmenu },
      {
        label: 'View',
        submenu: [
          { role: 'reload' },
          { role: 'forceReload' },
          { role: 'toggleDevTools' },
          { type: 'separator' },
          { role: 'resetZoom' },
          { role: 'zoomIn' },
          { role: 'zoomOut' },
          { type: 'separator' },
          { role: 'togglefullscreen' },
        ],
      },
      {
        label: 'Window',
        submenu: [
          { role: 'minimize' },
          { role: 'zoom' },
          { type: 'separator' },
          { role: 'front' },
        ],
      },
    ])
    Menu.setApplicationMenu(appMenu)
  } else {
    // Non-macOS: keep it minimal (the app has custom title bar)
    Menu.setApplicationMenu(Menu.buildFromTemplate([
      { label: 'Edit', submenu: editSubmenu },
    ]))
  }
}

// ─── App lifecycle ─────────────────────────────────────────────────────────────
app.whenReady().then(() => {
  // Build application menu with Edit submenu (enables Cmd/Ctrl+C/V/X/A)
  buildAppMenu()

  // Register IPC handlers BEFORE creating windows (prevents race on api-call)
  setupIPC()
  createSplashWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createSplashWindow()
    }
  })
})

app.on('window-all-closed', () => {
  app.quit()
})

// ─── Robust backend process cleanup ───────────────────────────────────────────
/** Kill the backend process (and its sub-processes via process group). */
function killBackendProcess() {
  // Kill from client.json PID first — catches orphaned processes from crashed sessions
  const cfg = loadClientConfig()
  if (cfg && cfg.backendPid > 0) {
    console.log(`[cleanup] Killing backend from client.json PID: ${cfg.backendPid}`)
    if (process.platform !== 'win32') {
      try { process.kill(-cfg.backendPid, 'SIGTERM') } catch {} // process group
    }
    try { process.kill(cfg.backendPid, 'SIGTERM') } catch {}     // direct
  }

  // Kill from tracked serverProcess object
  if (serverProcess) {
    console.log(`[cleanup] Killing backend process: ${serverProcess.pid}`)
    if (process.platform !== 'win32') {
      try { process.kill(-serverProcess.pid, 'SIGTERM') } catch {} // process group
    }
    try { serverProcess.kill('SIGTERM') } catch {}
    serverProcess = null
  }

  removePidFile()
}

// Register cleanup on all exit paths to ensure backend dies with Electron
app.on('before-quit', () => killBackendProcess())
app.on('will-quit', () => killBackendProcess())
process.on('exit', () => killBackendProcess())

// ─── Dev shortcut: Ctrl+Shift+H x3 opens DevTools ────────────────────────────
// Handled in the renderer via IPC
