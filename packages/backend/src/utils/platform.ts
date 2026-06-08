/**
 * Platform utility: get OS platform, architecture, version, and persistent UUID.
 * Compatible across Darwin (macOS), Linux, and Windows.
 *
 * UUID is persisted to ~/.clawgoal/client.json as the single storage location.
 *
 * UUID priority:
 *   1. Config file `~/.clawgoal/client.json`
 *   2. Physical hardware UUID (system_profiler / DMI / wmic)
 *   3. Docker host machine-id (via /proc/1/root or /host paths)
 *   4. Deterministic hash of MAC + hostname + machine-id
 *   5. Random UUID
 */
import fs from 'node:fs'
import os from 'node:os'
import { execSync } from 'node:child_process'
import crypto from 'node:crypto'
import { loadClientConfig, updateClientConfig } from './clientConfig.js'

/** Normalized platform name for the updater API */
export function getPlatformName(): string {
  const map: Record<string, string> = {
    darwin: 'osx',
    win32: 'win',
    linux: 'linux',
  }
  return map[os.platform()] || os.platform()
}

/** Normalized CPU architecture for the updater API */
export function getPlatformArch(): string {
  const map: Record<string, string> = {
    x64: 'x86',
    arm64: 'arm64',
    ia32: 'x86',
  }
  return map[os.arch()] || os.arch()
}

/** Human-readable OS version string (e.g. "15.3.0" for macOS, "10.0.26100" for Windows) */
export function getPlatformVersion(): string {
  try {
    const release = os.release()
    if (os.platform() === 'darwin') {
      const parts = release.split('.').map(Number)
      if (parts.length >= 1 && parts[0] >= 20) {
        const major = parts[0] - 9
        return `${major}.${parts[1] || 0}.${parts[2] || 0}`
      }
    }
    return release
  } catch {
    return ''
  }
}

/** Full platform info object */
export interface PlatformInfo {
  name: string
  arch: string
  version: string
}

export function getPlatformInfo(): PlatformInfo {
  return {
    name: getPlatformName(),
    arch: getPlatformArch(),
    version: getPlatformVersion(),
  }
}

/**
 * Detect if running inside a Docker container.
 */
function isDocker(): boolean {
  try {
    if (fs.existsSync('/.dockerenv')) return true
    const cgroup = fs.readFileSync('/proc/1/cgroup', 'utf-8')
    if (/docker|kubepods/i.test(cgroup)) return true
  } catch {
    // Not available, assume not Docker
  }
  return false
}

/**
 * Try to read a machine-id file at the given path, return uppercase trimmed string or null.
 */
function readMachineId(...paths: string[]): string | null {
  for (const p of paths) {
    try {
      const id = fs.readFileSync(p, 'utf-8').trim()
      if (id) return id.toUpperCase()
    } catch {
      continue
    }
  }
  return null
}

/**
 * Attempt to read the physical hardware UUID via platform-specific commands.
 * Returns null if all methods fail.
 */
function tryReadHardwareUUID(): string | null {
  const platform = os.platform()
  const tryCommands: (() => string)[] = []

  if (platform === 'darwin') {
    tryCommands.push(() => {
      const out = execSync('system_profiler SPHardwareDataType 2>/dev/null', {
        encoding: 'utf-8',
        timeout: 10000,
      })
      const match = out.match(/UUID:\s*(.+)/i)
      return match ? match[1].trim() : ''
    })
  } else if (platform === 'linux') {
    // DMI/SMBIOS product UUID (hardware-level, not available in Docker by default)
    tryCommands.push(() => {
      return fs
        .readFileSync('/sys/class/dmi/id/product_uuid', 'utf-8')
        .trim()
        .toUpperCase()
    })
    tryCommands.push(() => {
      return readMachineId('/var/lib/dbus/machine-id', '/etc/machine-id') || ''
    })
  } else if (platform === 'win32') {
    tryCommands.push(() => {
      const out = execSync('wmic csproduct get UUID', {
        encoding: 'utf-8',
        timeout: 10000,
      })
      return out.split('\n')[1]?.trim() || ''
    })
    tryCommands.push(() => {
      const out = execSync(
        'powershell -command "(Get-WmiObject Win32_ComputerSystemProduct).UUID"',
        { encoding: 'utf-8', timeout: 10000 }
      )
      return out.trim()
    })
  }

  for (const fn of tryCommands) {
    try {
      const result = fn()
      if (result && result !== '00000000-0000-0000-0000-000000000000')
        return result
    } catch {
      // Try next method
    }
  }
  return null
}

/**
 * In Docker, try to read the HOST machine's machine-id via paths that
 * may be exposed by the container runtime or orchestration layer.
 */
function tryReadDockerHostUUID(): string | null {
  if (!isDocker()) return null

  // Common paths where host's machine-id may be accessible:
  //   /proc/1/root/etc/machine-id     — works with --pid=host
  //   /host/etc/machine-id            — common convention
  //   /run/host/etc/machine-id        — alternative convention
  return readMachineId(
    '/proc/1/root/etc/machine-id',
    '/host/etc/machine-id',
    '/run/host/etc/machine-id',
    '/etc/machine-id',
    '/var/lib/dbus/machine-id'
  )
}

/**
 * Deterministic fallback: hash of MAC address + hostname + any readable machine-id.
 * Works reliably in Docker, VM, and bare-metal environments.
 */
function generateMacBasedUUID(): string {
  const interfaces = os.networkInterfaces()
  let mac = 'unknown'
  for (const name of Object.keys(interfaces)) {
    const iface = interfaces[name]?.find(
      (i) => !i.internal && i.mac !== '00:00:00:00:00:00'
    )
    if (iface?.mac) {
      mac = iface.mac
      break
    }
  }
  const machineId =
    readMachineId('/etc/machine-id', '/var/lib/dbus/machine-id') || ''
  const hash = crypto
    .createHash('sha1')
    .update(`${mac}-${os.hostname()}-${machineId}`)
    .digest('hex')
    .toUpperCase()
  return hash.slice(0, 32)
}

/**
 * Read the persisted UUID from ~/.clawgoal/client.json, or return null if missing.
 */
function readPersistedUUID(): string | null {
  const cfg = loadClientConfig()
  return cfg?.uuid || null
}

/**
 * Persist a UUID to ~/.clawgoal/client.json so it survives restarts.
 */
function persistUUID(uuid: string): void {
  updateClientConfig({ uuid })
}

/**
 * Absolute last resort: generate a random UUID.
 */
function generateRandomUUID(): string {
  return crypto.randomUUID().replace(/-/g, '').toUpperCase()
}

/**
 * Get a persistent device UUID with the following priority:
 *
 *   1. Config file `~/.clawgoal/client.json`
 *   2. Physical hardware UUID (system_profiler / DMI / wmic)
 *   3. Docker host machine-id (via /proc/1/root, /host, etc.)
 *   4. Deterministic hash of MAC + hostname + machine-id
 *   5. Random UUID
 *
 * The UUID is always persisted to ~/.clawgoal/client.json as the single storage location.
 */
export function getDeviceUUID(): string {
  // ① Check if already persisted
  const persisted = readPersistedUUID()
  if (persisted) return persisted

  // ② Hardware UUID
  let uuid = tryReadHardwareUUID()

  // ③ Docker host machine-id
  if (!uuid) {
    uuid = tryReadDockerHostUUID()
  }

  // ④ MAC + hostname hash
  if (!uuid) {
    uuid = generateMacBasedUUID()
  }

  // ⑤ Generate random UUID
  if (!uuid) {
    uuid = generateRandomUUID()
  }

  // Persist to ~/.clawgoal/client.json for next time
  persistUUID(uuid)

  return uuid
}

/**
 * Build the custom User-Agent string used by the updater/collector API.
 * Format: AppOpen|Pro/<AppName>/<Version> Platform/<name>/<arch>/<version>/<UUID>
 *
 * Example: AppOpen/ClawGoal/1.0.0 Platform/osx/arm64/15.3.0/5FF02BC4760011EDB662C94E1F404F00
 */
export function buildUserAgent(): string {
  const type = AppConfig.type === 'pro' ? 'Pro' : 'Open'
  const info = getPlatformInfo()
  const uuid = getDeviceUUID()
  return `App${type}/${AppConfig.name}/${AppConfig.version} Platform/${info.name}/${info.arch}/${info.version}/${uuid}`
}

// Import late to avoid circular dependency with config.ts
import { AppConfig } from '../config.js'
