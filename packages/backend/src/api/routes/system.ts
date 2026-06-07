import { Router } from 'express'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { config } from '../../config/index.js'
import { AppConfig } from '../../config.js'
import { apiHandler } from '../../utils/api.js'
import { success, error } from '../../utils/response.js'
import { getUserAgent } from '../../utils/utils.js'
import {
  getPlatformInfo,
  getDeviceUUID,
  buildUserAgent,
} from '../../utils/platform.js'

const router = Router()

let lastCpuInfo = os.cpus()

function getDiskStats(): {
  total: number
  used: number
  free: number
  usagePercent: number
} {
  try {
    const targetPath = process.platform === 'win32' ? 'C:\\' : '/'
    const stat = fs.statfsSync(targetPath)
    const total = stat.blocks * stat.bsize
    const free = stat.bavail * stat.bsize
    const used = total - free
    return {
      total,
      used,
      free,
      usagePercent: Math.round((used / total) * 100 * 10) / 10,
    }
  } catch {
    return { total: 0, used: 0, free: 0, usagePercent: 0 }
  }
}

function getCpuUsage(): number {
  const currentCpus = os.cpus()

  let totalIdle = 0
  let totalTick = 0

  for (let i = 0; i < currentCpus.length; i++) {
    const prevCpu = lastCpuInfo[i]
    const currCpu = currentCpus[i]
    if (!prevCpu) continue

    const prevTotal = Object.values(prevCpu.times).reduce((a, b) => a + b, 0)
    const currTotal = Object.values(currCpu.times).reduce((a, b) => a + b, 0)

    totalTick += currTotal - prevTotal
    totalIdle += currCpu.times.idle - prevCpu.times.idle
  }

  lastCpuInfo = currentCpus

  if (totalTick === 0) return 0
  return Math.round((1 - totalIdle / totalTick) * 100 * 10) / 10
}

/**
 * @Api /api/system/stats
 * @Summary Get stats system
 * @ReturnDataExample {"cpu":{"usage":12.5,"count":8,"model":"Intel..."},"memory":{"total":17179869184,"used":8589934592,"free":8589934592,"usagePercent":50.0},"connections":{"manage":2,"extension":0,"connector":0,"agent":1},"disk":{"total":512000000000,"used":256000000000,"free":256000000000,"usagePercent":50.0},"uptime":3600}
 */
router.post(
  '/system/stats',
  apiHandler(async (_req, res) => {
    const totalMem = os.totalmem()
    const freeMem = os.freemem()
    const usedMem = totalMem - freeMem

    const processMemUsage = process.memoryUsage()

    const cpuUsage = getCpuUsage()

    let wsStats: Record<string, any> = {}
    try {
      const { wsService } = await import('../../websocket/index.js')
      wsStats = wsService.getStats()
    } catch {
      // wsService may not be initialized yet
    }

    return success(res, {
      cpu: {
        usage: cpuUsage,
        count: os.cpus().length,
        model: os.cpus()[0]?.model ?? '',
      },
      memory: {
        total: totalMem,
        used: usedMem,
        free: freeMem,
        usagePercent: Math.round((usedMem / totalMem) * 100 * 10) / 10,
      },
      process: {
        rss: processMemUsage.rss,
        heapUsed: processMemUsage.heapUsed,
        heapTotal: processMemUsage.heapTotal,
        external: processMemUsage.external,
        arrayBuffers: processMemUsage.arrayBuffers ?? 0,
      },
      connections: {
        manage: wsStats.totalConnections ?? 0,
        extension: wsStats.botConnections ?? 0,
        connector: wsStats.connectorConnections ?? 0,
        agent: wsStats.agentConnections ?? 0,
      },
      disk: getDiskStats(),
      uptime: Math.floor(process.uptime()),
      platform: os.platform(),
      arch: os.arch(),
    })
  })
)

/**
 * @Api /api/system/pathList
 * @Summary List paths system
 * @BodyParam path string Directory path to list; defaults to user home directory
 * @ReturnDataExample {"path":"/home/user","items":[{"name":"docs","type":"dir","path":"/home/user/docs"},{"name":"file.txt","type":"file","path":"/home/user/file.txt"}]}
 */
router.post(
  '/system/pathList',
  apiHandler(async (req, res) => {
    const reqPath = (req.body as { path?: string }).path || os.homedir()
    const resolved = path.resolve(reqPath)

    let items: { name: string; type: 'file' | 'dir'; path: string }[]
    try {
      const entries = fs.readdirSync(resolved, { withFileTypes: true })
      items = entries
        .filter((e) => e.isDirectory() || e.isFile())
        .map((e) => ({
          name: e.name,
          type: (e.isDirectory() ? 'dir' : 'file') as 'file' | 'dir',
          path: path.join(resolved, e.name),
        }))
        .sort((a, b) => {
          if (a.type !== b.type) return a.type === 'dir' ? -1 : 1
          return a.name.localeCompare(b.name)
        })
    } catch {
      items = []
    }

    const parentPath = path.dirname(resolved)
    return success(res, {
      path: resolved,
      parentPath: resolved !== parentPath ? parentPath : null,
      items,
    })
  })
)

/**
 * @Api /api/system/collectEnv
 * @Summary 收集环境信息（用于意见反馈）
 * @ReturnDataExample {"appName":"clawgoal","appVersion":"1.0.0","platform":"darwin","arch":"x64","nodeVersion":"v20.0.0","uptime":3600}
 */
router.post(
  '/system/collectEnv',
  apiHandler(async (_req, res) => {
    return success(res, {
      appName: AppConfig.name,
      appVersion: AppConfig.title,
      platform: os.platform(),
      arch: os.arch(),
      nodeVersion: process.version,
      uptime: Math.floor(process.uptime()),
    })
  })
)

/**
 * @Api /api/system/collectLog
 * @Summary 收集日志内容（用于意见反馈）
 * @BodyParam startTime? string 开始时间（格式 YYYY-MM-DD HH:mm:ss）
 * @BodyParam endTime? string 结束时间（格式 YYYY-MM-DD HH:mm:ss）
 * @ReturnDataExample {"logs":"...","startTime":"2024-01-01 00:00:00","endTime":"2024-01-01 23:59:59"}
 */
router.post(
  '/system/collectLog',
  apiHandler(async (req, res) => {
    const { startTime, endTime } = req.body as {
      startTime?: string
      endTime?: string
    }

    const logDir = config.logPath
    const startMs = startTime
      ? new Date(startTime).getTime()
      : Date.now() - 24 * 60 * 60 * 1000
    const endMs = endTime ? new Date(endTime).getTime() : Date.now()

    const actualStart = new Date(startMs)
    const actualEnd = new Date(endMs)

    const pad = (n: number) => String(n).padStart(2, '0')
    const toDateStr = (d: Date) =>
      `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`

    // 收集时间范围内所有日志文件
    const logLines: string[] = []
    try {
      const files = fs.readdirSync(logDir).filter((f) => f.endsWith('.log'))
      const startDateStr = toDateStr(actualStart)
      const endDateStr = toDateStr(actualEnd)

      for (const file of files.sort()) {
        // 文件名格式：<name>-YYYYMMDD.log，提取日期部分
        const match = file.match(/-(\d{8})\.log$/)
        if (!match) continue
        const fileDateStr = match[1]
        if (fileDateStr < startDateStr || fileDateStr > endDateStr) continue

        const filePath = path.join(logDir, file)
        try {
          const content = fs.readFileSync(filePath, 'utf-8')
          const lines = content.split('\n').filter((l) => l.trim())
          for (const line of lines) {
            // 尝试解析时间戳过滤
            try {
              const parsed = JSON.parse(line)
              const lineTime = parsed.time ? new Date(parsed.time).getTime() : 0
              if (lineTime && (lineTime < startMs || lineTime > endMs)) continue
            } catch {
              // 非 JSON 行直接保留
            }
            logLines.push(line)
          }
        } catch {
          // 单个文件读取失败跳过
        }
      }
    } catch {
      // 日志目录不可读
    }

    const pad2 = (n: number) => String(n).padStart(2, '0')
    const fmtDate = (d: Date) =>
      `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`

    return success(res, {
      logs: logLines.join('\n'),
      startTime: fmtDate(actualStart),
      endTime: fmtDate(actualEnd),
    })
  })
)

/**
 * @Api /api/system/checkVersion
 * @Summary Check for latest version
 * @BodyParam currentVersion string Current app version (e.g. "1.0.0")
 * @ReturnDataExample {"hasNew":true,"latestVersion":"2.0.0","downloadUrl":"https://clawgoal.com"}
 */
router.post(
  '/system/checkVersion',
  apiHandler(async (req, res) => {
    const { currentVersion } = req.body as {
      currentVersion?: string
    }

    try {
      const versionCheckUrl = AppConfig.versionCheckUrl
      if (!versionCheckUrl) {
        return error(res, -1, 'Version check URL not configured')
      }

      const platform = getPlatformInfo()
      const uuid = getDeviceUUID()

      // Build URL with type suffix: /app_manager/updater/open or /app_manager/updater/pro
      const url = `${versionCheckUrl.replace(/\/+$/, '')}/${AppConfig.type}`

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': buildUserAgent(),
        },
        body: JSON.stringify({
          uuid,
          version: currentVersion || AppConfig.version,
          platform,
        }),
      })

      const result = await response.json()
      const data = result?.data || result
      const latestVersion = data?.version || ''
      const summary = data?.summary || ''
      const feature = data?.feature || ''
      const releaseDate = data?.time || ''
      const downloadUrl = data?.url || AppConfig.website

      return success(res, {
        hasNew: !!latestVersion,
        latestVersion,
        summary,
        feature,
        releaseDate,
        downloadUrl,
        currentVersion: currentVersion || AppConfig.version,
      })
    } catch (e: any) {
      return error(res, -1, `Version check failed: ${e.message}`)
    }
  })
)

export default router
