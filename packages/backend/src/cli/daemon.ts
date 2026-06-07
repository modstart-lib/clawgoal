import { exec, execSync, spawn } from 'child_process'
import { Command } from 'commander'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { AppConfig } from '../config.js'
import { config, isDependOnWorkingDirectory } from '../config/index.js'

export class DaemonManager {
  private pidFile: string
  private logFile: string
  private errorLogFile: string

  constructor() {
    const dataDir = path.join(os.homedir(), `.${AppConfig.name}`)
    try {
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true })
      }
    } catch {
      // Home directory may be inaccessible (e.g. Docker container running as a mapped uid
      // with no /etc/passwd entry). Daemon pid/log paths will be unavailable, but `serve`
      // mode doesn't need them.
    }

    this.pidFile = path.join(dataDir, 'daemon.pid')
    this.logFile = path.join(dataDir, 'daemon.log')
    this.errorLogFile = path.join(dataDir, 'daemon.error.log')
  }

  /**
   * Get the PID of the running daemon
   */
  private getPid(): number | null {
    try {
      if (fs.existsSync(this.pidFile)) {
        const pid = parseInt(fs.readFileSync(this.pidFile, 'utf-8').trim(), 10)
        return isNaN(pid) ? null : pid
      }
    } catch (error) {
      return null
    }
    return null
  }

  /**
   * Check if a process is running
   */
  private isProcessRunning(pid: number): boolean {
    try {
      // Sending signal 0 checks if process exists without killing it
      process.kill(pid, 0)
      return true
    } catch (error) {
      return false
    }
  }

  /**
   * Get daemon status
   */
  public getStatus(): { running: boolean; pid?: number; message: string } {
    const pid = this.getPid()

    if (pid === null) {
      return {
        running: false,
        message: 'Daemon is not running (no PID file found)',
      }
    }

    if (this.isProcessRunning(pid)) {
      return {
        running: true,
        pid,
        message: `Daemon is running (PID: ${pid})`,
      }
    } else {
      // PID file exists but process is not running
      fs.unlinkSync(this.pidFile)
      return {
        running: false,
        message: 'Daemon is not running (stale PID file removed)',
      }
    }
  }

  /**
   * Poll POST /api/ping until the API returns success (DB and subsystems ready).
   */
  private async waitForApiPingReady(
    timeoutMs = 120_000,
    intervalMs = 10_000
  ): Promise<void> {
    let port: number
    try {
      port = (config.port as number) || 53001
    } catch {
      port = 53001
    }
    const url = `http://127.0.0.1:${port}/api/ping`
    const deadline = Date.now() + timeoutMs
    while (Date.now() < deadline) {
      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: '{}',
        })
        if (res.ok) {
          const j = (await res.json()) as { code?: number }
          if (j.code === 0) return
        }
      } catch {
        /* ECONNREFUSED / reset while process starts */
      }
      await new Promise((r) => setTimeout(r, intervalMs))
    }
    throw new Error('timeout')
  }

  private formatDaemonStartErrorDetail(err: 'ignore' | number): string {
    let detail = ''
    try {
      if (typeof err === 'number') {
        fs.fsyncSync(err)
      }
      const errPath = this.errorLogFile
      if (fs.existsSync(errPath)) {
        const lines = fs.readFileSync(errPath, 'utf-8').trim().split('\n')
        const tail = lines.slice(-20).join('\n').trim()
        if (tail) detail = `\n--- error log ---\n${tail}`
      }
    } catch {
      /* ignore */
    }
    return detail
  }

  /**
   * Start the daemon
   */
  public async start(): Promise<{ success: boolean; message: string }> {
    const platform = os.platform()

    // If managed by systemd, use systemctl start
    if (platform === 'linux' && this.isSystemdInstalled()) {
      try {
        const sudo = process.getuid?.() === 0 ? '' : 'sudo '
        execSync(`${sudo}systemctl start ${AppConfig.name}`, {
          stdio: 'ignore',
        })
        return { success: true, message: 'Daemon started via systemctl' }
      } catch (error) {
        return {
          success: false,
          message: `Failed to start via systemctl: ${error instanceof Error ? error.message : String(error)}`,
        }
      }
    }

    // If managed by launchd, use launchctl load
    if (platform === 'darwin' && this.isLaunchdInstalled()) {
      try {
        const plistPath = path.join(
          os.homedir(),
          `Library/LaunchAgents/com.${AppConfig.name}.daemon.plist`
        )
        execSync(`launchctl load "${plistPath}"`, { stdio: 'ignore' })
        return { success: true, message: 'Daemon started via launchctl' }
      } catch (error) {
        return {
          success: false,
          message: `Failed to start via launchctl: ${error instanceof Error ? error.message : String(error)}`,
        }
      }
    }

    // Fall back to PID-based start
    const status = this.getStatus()

    if (status.running) {
      return {
        success: false,
        message: `Daemon is already running (PID: ${status.pid})`,
      }
    }

    try {
      // Open log files (fall back to /dev/null if the data dir is not writable)
      let out: 'ignore' | number = 'ignore'
      let err: 'ignore' | number = 'ignore'
      try {
        out = fs.openSync(this.logFile, 'a')
        err = fs.openSync(this.errorLogFile, 'a')
      } catch {
        // Log files unavailable – discard output
      }

      // Build environment
      const env: NodeJS.ProcessEnv = { ...process.env, NODE_ENV: 'production' }
      // Use 'serve' sub-command so the binary handles serve mode directly
      const args = ['serve']

      // Spawn the daemon process using the current binary (process.execPath),
      // instead of 'node' + virtual /$bunfs/root/index.js which doesn't work
      // when the binary is compiled with `bun build --compile`.
      const child = spawn(process.execPath, args, {
        detached: true,
        stdio: ['ignore', out, err],
        env,
      })

      // Unref so parent can exit
      child.unref()

      // Save PID
      fs.writeFileSync(this.pidFile, child.pid!.toString())

      try {
        await this.waitForApiPingReady()
      } catch {
        const checkStatus = this.getStatus()
        const detail = this.formatDaemonStartErrorDetail(err)
        if (!checkStatus.running) {
          return {
            success: false,
            message: `Failed to start daemon${detail}`,
          }
        }
        return {
          success: false,
          message: `Daemon process is running (PID: ${checkStatus.pid}) but POST /api/ping did not succeed within timeout${detail}`,
        }
      }

      const checkStatus = this.getStatus()
      if (!checkStatus.running) {
        const detail = this.formatDaemonStartErrorDetail(err)
        return {
          success: false,
          message: `Failed to start daemon${detail}`,
        }
      }

      return {
        success: true,
        message: `Daemon started successfully (PID: ${checkStatus.pid})`,
      }
    } catch (error) {
      return {
        success: false,
        message: `Failed to start daemon: ${error instanceof Error ? error.message : String(error)}`,
      }
    }
  }

  /**
   * Check if a systemd service file is installed
   */
  private isSystemdInstalled(): boolean {
    return fs.existsSync(`/etc/systemd/system/${AppConfig.name}.service`)
  }

  /**
   * Check if a launchd plist is installed
   */
  private isLaunchdInstalled(): boolean {
    const plistPath = path.join(
      os.homedir(),
      `Library/LaunchAgents/com.${AppConfig.name}.daemon.plist`
    )
    return fs.existsSync(plistPath)
  }

  /**
   * Stop the daemon
   */
  public stop(): { success: boolean; message: string } {
    const platform = os.platform()

    // If managed by systemd, use systemctl stop (prevents auto-restart)
    if (platform === 'linux' && this.isSystemdInstalled()) {
      try {
        const sudo = process.getuid?.() === 0 ? '' : 'sudo '
        execSync(`${sudo}systemctl stop ${AppConfig.name}`, {
          stdio: 'ignore',
        })
        return { success: true, message: 'Daemon stopped via systemctl' }
      } catch (error) {
        return {
          success: false,
          message: `Failed to stop via systemctl: ${error instanceof Error ? error.message : String(error)}`,
        }
      }
    }

    // If managed by launchd, use launchctl unload (prevents auto-restart)
    if (platform === 'darwin' && this.isLaunchdInstalled()) {
      try {
        const plistPath = path.join(
          os.homedir(),
          `Library/LaunchAgents/com.${AppConfig.name}.daemon.plist`
        )
        execSync(`launchctl unload "${plistPath}"`, { stdio: 'ignore' })
        return { success: true, message: 'Daemon stopped via launchctl' }
      } catch (error) {
        return {
          success: false,
          message: `Failed to stop via launchctl: ${error instanceof Error ? error.message : String(error)}`,
        }
      }
    }

    // Fall back to PID-based stop
    const status = this.getStatus()

    if (!status.running) {
      return {
        success: false,
        message: 'Daemon is not running',
      }
    }

    try {
      const pid = status.pid!

      // Send SIGTERM
      process.kill(pid, 'SIGTERM')

      // Wait for process to exit
      let attempts = 0
      const maxAttempts = 10

      while (attempts < maxAttempts) {
        if (!this.isProcessRunning(pid)) {
          fs.unlinkSync(this.pidFile)
          return {
            success: true,
            message: `Daemon stopped successfully (PID: ${pid})`,
          }
        }

        // Wait 500ms before checking again
        const waitMs = 500
        const endTime = Date.now() + waitMs
        while (Date.now() < endTime) {
          // Busy wait
        }
        attempts++
      }

      // Force kill if still running
      if (this.isProcessRunning(pid)) {
        process.kill(pid, 'SIGKILL')
        fs.unlinkSync(this.pidFile)
        return {
          success: true,
          message: `Daemon forcefully stopped (PID: ${pid})`,
        }
      }

      return {
        success: false,
        message: 'Failed to stop daemon',
      }
    } catch (error) {
      return {
        success: false,
        message: `Failed to stop daemon: ${error instanceof Error ? error.message : String(error)}`,
      }
    }
  }

  /**
   * Restart the daemon
   */
  public async restart(): Promise<{ success: boolean; message: string }> {
    const stopResult = this.stop()

    // Wait a bit before starting
    const waitMs = 1000
    const endTime = Date.now() + waitMs
    while (Date.now() < endTime) {
      // Busy wait
    }

    const startResult = await this.start()

    return {
      success: startResult.success,
      message: `Restart: ${stopResult.message}\n${startResult.message}`,
    }
  }

  /**
   * Kill any process occupying the given port (best-effort, cross-platform).
   */
  private killPortProcess(port: number): void {
    try {
      const platform = os.platform()
      if (platform === 'linux') {
        execSync(`fuser -k ${port}/tcp`, { stdio: 'ignore' })
      } else {
        // macOS / other UNIX
        execSync(`lsof -ti:${port} | xargs kill -9`, {
          stdio: 'ignore',
          shell: '/bin/sh',
        })
      }
    } catch {
      // No process was using the port, or kill failed — ignore
    }
  }

  /**
   * Stop service, copy current binary to system path, then restart
   */
  public async updateSelf(): Promise<{ success: boolean; message: string }> {
    console.log('Stopping service...')
    const stopResult = this.stop()
    console.log(stopResult.message)

    // Also kill any orphaned process still holding the port (e.g. started via
    // systemd/launchd without a tracked PID file).
    try {
      const port = (config.port as number) || 53001
      this.killPortProcess(port)
    } catch {
      // config not readable — skip port cleanup
    }

    // Wait for the port to be fully released by the OS.
    await new Promise((resolve) => setTimeout(resolve, 5000))

    console.log('Copying current binary to system path...')
    const binaryResult = this.installBinary()
    console.log(binaryResult.message)
    if (!binaryResult.success) {
      return {
        success: false,
        message: `Update failed: ${binaryResult.message}`,
      }
    }

    console.log('Starting service...')
    const startResult = await this.start()
    console.log(startResult.message)

    return {
      success: startResult.success,
      message: startResult.success
        ? 'Service updated and restarted successfully'
        : `Failed to start after update: ${startResult.message}`,
    }
  }

  /**
   * Get environment variables for daemon service installation
   */
  private getInstallEnvs(): Record<string, string> {
    const envs: Record<string, string> = { NODE_ENV: 'production' }
    const appType = process.env.APP_TYPE
    if (appType) {
      envs['APP_TYPE'] = appType
    }
    return envs
  }

  /**
   * Get system binary install path
   */
  private getBinaryInstallPath(): string {
    return `/usr/local/bin/${AppConfig.name}`
  }

  /**
   * Copy current binary to system path.
   * Uses copy-to-tmp then rename to avoid "Text file busy" on Linux when the
   * destination binary is currently executed by a running process.
   * rename(2) atomically replaces the path; the running process keeps its old inode.
   */
  private installBinary(): { success: boolean; message: string } {
    const srcPath = process.execPath
    const destPath = this.getBinaryInstallPath()
    const tmpPath = destPath + '.tmp'
    try {
      fs.copyFileSync(srcPath, tmpPath)
      fs.chmodSync(tmpPath, 0o755)
      fs.renameSync(tmpPath, destPath)
      return { success: true, message: `Binary installed to ${destPath}` }
    } catch {
      try {
        execSync(
          `sudo cp "${srcPath}" "${tmpPath}" && sudo chmod 755 "${tmpPath}" && sudo mv "${tmpPath}" "${destPath}"`,
          { stdio: 'inherit' }
        )
        return { success: true, message: `Binary installed to ${destPath}` }
      } catch {
        return {
          success: false,
          message: `Failed to install binary to ${destPath}. Run manually:\nsudo cp "${srcPath}" "${destPath}"\nsudo chmod 755 "${destPath}"`,
        }
      }
    }
  }

  /**
   * Remove binary from system path
   */
  private removeBinary(): void {
    const destPath = this.getBinaryInstallPath()
    if (!fs.existsSync(destPath)) return
    try {
      fs.unlinkSync(destPath)
    } catch {
      try {
        execSync(`sudo rm "${destPath}"`, { stdio: 'inherit' })
      } catch {
        // ignore
      }
    }
  }

  /**
   * Install daemon (create systemd service or launchd plist)
   */
  public install(): { success: boolean; message: string } {
    const platform = os.platform()

    const binaryResult = this.installBinary()
    if (!binaryResult.success) {
      return binaryResult
    }

    if (platform === 'darwin') {
      return this.installLaunchd()
    } else if (platform === 'linux') {
      return this.installSystemd()
    } else {
      return {
        success: false,
        message: `Daemon installation not supported on ${platform}. Use '${AppConfig.name} daemon start' to run manually.`,
      }
    }
  }

  /**
   * Uninstall daemon
   */
  public uninstall(): { success: boolean; message: string } {
    const platform = os.platform()

    // Stop daemon first
    this.stop()

    let result: { success: boolean; message: string }
    if (platform === 'darwin') {
      result = this.uninstallLaunchd()
    } else if (platform === 'linux') {
      result = this.uninstallSystemd()
    } else {
      result = {
        success: true,
        message: 'Daemon stopped (no system service to uninstall)',
      }
    }

    this.removeBinary()
    return result
  }

  /**
   * Install macOS launchd service
   */
  private installLaunchd(): { success: boolean; message: string } {
    try {
      const plistPath = path.join(
        os.homedir(),
        `Library/LaunchAgents/com.${AppConfig.name}.daemon.plist`
      )
      const binaryPath = this.getBinaryInstallPath()

      const envContent = Object.entries(this.getInstallEnvs())
        .map(
          ([k, v]) => `        <key>${k}</key>\n        <string>${v}</string>`
        )
        .join('\n')

      const argsContent = `        <string>${binaryPath}</string>\n        <string>serve</string>`

      const workDirContent = isDependOnWorkingDirectory()
        ? `    <key>WorkingDirectory</key>\n    <string>${process.cwd()}</string>\n`
        : ''

      const plistContent = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.${AppConfig.name}.daemon</string>
    <key>ProgramArguments</key>
    <array>
${argsContent}
    </array>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>StandardOutPath</key>
    <string>${this.logFile}</string>
    <key>StandardErrorPath</key>
    <string>${this.errorLogFile}</string>
    <key>EnvironmentVariables</key>
    <dict>
${envContent}
    </dict>
${workDirContent}</dict>
</plist>`

      // Ensure LaunchAgents directory exists
      const launchAgentsDir = path.dirname(plistPath)
      if (!fs.existsSync(launchAgentsDir)) {
        fs.mkdirSync(launchAgentsDir, { recursive: true })
      }

      fs.writeFileSync(plistPath, plistContent)

      // Load the service
      exec(`launchctl load ${plistPath}`, (error) => {
        if (error) {
          console.error(`Failed to load service: ${error.message}`)
        }
      })

      return {
        success: true,
        message: `Daemon installed as launchd service\nBinary: ${binaryPath}\nPlist: ${plistPath}\nUse 'launchctl start com.${AppConfig.name}.daemon' to start`,
      }
    } catch (error) {
      return {
        success: false,
        message: `Failed to install launchd service: ${error instanceof Error ? error.message : String(error)}`,
      }
    }
  }

  /**
   * Uninstall macOS launchd service
   */
  private uninstallLaunchd(): { success: boolean; message: string } {
    try {
      const plistPath = path.join(
        os.homedir(),
        `Library/LaunchAgents/com.${AppConfig.name}.daemon.plist`
      )

      if (fs.existsSync(plistPath)) {
        // Unload the service
        exec(`launchctl unload ${plistPath}`, (error) => {
          if (error) {
            console.error(`Failed to unload service: ${error.message}`)
          }
        })

        // Remove the plist file
        fs.unlinkSync(plistPath)

        return {
          success: true,
          message: `Daemon uninstalled (removed ${plistPath})`,
        }
      } else {
        return {
          success: true,
          message: 'No launchd service found to uninstall',
        }
      }
    } catch (error) {
      return {
        success: false,
        message: `Failed to uninstall launchd service: ${error instanceof Error ? error.message : String(error)}`,
      }
    }
  }

  /**
   * Install Linux systemd service
   */
  private installSystemd(): { success: boolean; message: string } {
    try {
      const servicePath = `/etc/systemd/system/${AppConfig.name}.service`
      const binaryPath = this.getBinaryInstallPath()
      const user = os.userInfo().username

      const envContent = Object.entries(this.getInstallEnvs())
        .map(([k, v]) => `Environment=${k}=${v}`)
        .join('\n')

      const execStart = `${binaryPath} serve`

      const workDirLine = isDependOnWorkingDirectory()
        ? `\nWorkingDirectory=${process.cwd()}`
        : ''

      const serviceContent = `[Unit]
Description=${AppConfig.title} Daemon
After=network.target

[Service]
Type=simple
User=${user}
ExecStart=${execStart}
Restart=always
${envContent}${workDirLine}
StandardOutput=append:${this.logFile}
StandardError=append:${this.errorLogFile}

[Install]
WantedBy=multi-user.target
`

      const isRoot = process.getuid?.() === 0

      if (isRoot) {
        fs.writeFileSync(servicePath, serviceContent)
        execSync('systemctl daemon-reload')
        execSync(`systemctl enable ${AppConfig.name}`)
        execSync(`systemctl start ${AppConfig.name}`)
        return {
          success: true,
          message: `Daemon installed as systemd service\nService: ${servicePath}\nUse 'systemctl status ${AppConfig.name}' to check status`,
        }
      } else {
        // Not root — save to a temp file and use sudo (prompts for password in terminal)
        const tmpServicePath = path.join(
          path.dirname(this.pidFile),
          `${AppConfig.name}.service`
        )
        fs.writeFileSync(tmpServicePath, serviceContent)
        try {
          execSync(`sudo cp "${tmpServicePath}" "${servicePath}"`, {
            stdio: 'inherit',
          })
          execSync('sudo systemctl daemon-reload', { stdio: 'inherit' })
          execSync(`sudo systemctl enable ${AppConfig.name}`, {
            stdio: 'inherit',
          })
          execSync(`sudo systemctl start ${AppConfig.name}`, {
            stdio: 'inherit',
          })
          return {
            success: true,
            message: `Daemon installed as systemd service\nService: ${servicePath}\nUse 'systemctl status ${AppConfig.name}' to check status`,
          }
        } catch {
          return {
            success: false,
            message: `Sudo failed. Run manually:\nsudo cp "${tmpServicePath}" "${servicePath}"\nsudo systemctl daemon-reload\nsudo systemctl enable ${AppConfig.name}\nsudo systemctl start ${AppConfig.name}`,
          }
        }
      }
    } catch (error) {
      return {
        success: false,
        message: `Failed to install systemd service: ${error instanceof Error ? error.message : String(error)}`,
      }
    }
  }

  /**
   * Uninstall Linux systemd service
   */
  private uninstallSystemd(): { success: boolean; message: string } {
    return {
      success: false,
      message: `Please run:\nsudo systemctl stop ${AppConfig.name}\nsudo systemctl disable ${AppConfig.name}\nsudo rm /etc/systemd/system/${AppConfig.name}.service\nsudo systemctl daemon-reload`,
    }
  }
}

export function registerDaemonCommand(
  program: Command,
  daemonManager: DaemonManager
) {
  const daemon = program
    .command('daemon')
    .description(`Manage ${AppConfig.title} daemon service`)

  daemon
    .command('status')
    .description('Check daemon status')
    .action(() => {
      const result = daemonManager.getStatus()
      console.log(result.message)
      process.exit(result.running ? 0 : 1)
    })

  daemon
    .command('start')
    .description('Start daemon in background')
    .action(async () => {
      const result = await daemonManager.start()
      console.log(result.message)
      process.exit(result.success ? 0 : 1)
    })

  daemon
    .command('stop')
    .description('Stop daemon')
    .action(() => {
      const result = daemonManager.stop()
      console.log(result.message)
      process.exit(result.success ? 0 : 1)
    })

  daemon
    .command('restart')
    .description('Restart daemon')
    .action(async () => {
      const result = await daemonManager.restart()
      console.log(result.message)
      process.exit(result.success ? 0 : 1)
    })

  daemon
    .command('install')
    .description('Install daemon as system service (systemd/launchd)')
    .action(() => {
      const result = daemonManager.install()
      console.log(result.message)
      process.exit(result.success ? 0 : 1)
    })

  daemon
    .command('update-self')
    .description('Stop service, update binary to system path, then restart')
    .action(async () => {
      const result = await daemonManager.updateSelf()
      process.exit(result.success ? 0 : 1)
    })

  daemon
    .command('uninstall')
    .description('Uninstall daemon system service')
    .action(() => {
      const result = daemonManager.uninstall()
      console.log(result.message)
      process.exit(result.success ? 0 : 1)
    })
}
