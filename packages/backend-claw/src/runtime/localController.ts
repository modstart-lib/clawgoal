import { discoverRunners } from '../connect/index.js'
import { clawEventBus } from '../kernel/eventBus.js'
import { createLogger } from '../kernel/logger.js'
import { getParam, setParam } from '../../../backend/src/utils/userParam.js'
import type { RunnerInfo, RuntimeRow } from '../storage/store/index.js'
import type { IRuntimeController, SendRunRunnerOpts } from './controller.js'
import { spawnSync } from 'child_process'
import { readdirSync, existsSync } from 'fs'
import * as path from 'path'
import { config } from '../../../backend/src/config/index.js'

const logger = createLogger('local-runtime')

const LOCAL_RUNTIME_PARAM_KEY = 'ClawLocalRuntimeRunners'

/**
 * 本机运行环境控制器（单例）
 *
 * - runner 的 name/title/status 缓存在内存（机器级别）
 * - runner 的 enable 开关按用户存在 params 表
 * - 执行任务通过直接调用 runRunnerTool() 完成，结果通过 runtimeWs.emitSessionEvent() 注入事件流
 *   与 WS 运行环境完全兼容，tools 层可无差别调用 waitForSession()
 */
class LocalRuntimeController implements IRuntimeController {
  /** 已发现的本机 runner（只含 name/title/status，不含 enable） */
  private cachedRunners: RunnerInfo[] = []

  async init(): Promise<void> {
    this.cachedRunners = await discoverRunners()
    logger.info(
      `本机 runner 扫描完成: ${this.cachedRunners.map((e) => e.name).join(', ') || '(无)'}`
    )
  }

  async getRuntimeRow(tenantId: number, userId: number): Promise<RuntimeRow> {
    const enableMap = await this._loadEnableMap(tenantId, userId)
    const runners: RunnerInfo[] = this.cachedRunners.map((e) => ({
      name: e.name,
      title: e.title,
      status: e.status,
      enable: enableMap[e.name] !== undefined ? enableMap[e.name] : true,
    }))

    return {
      id: 0,
      created_at: '',
      updated_at: '',
      tenant_id: tenantId,
      user_id: userId,
      name: 'local',
      title: config.lang !== 'en-US' ? '本机' : 'Local',
      token: '',
      status: 'online',
      active_at: null,
      runners: JSON.stringify(runners),
    }
  }

  sendExecute(sessionId: string, opts: SendRunRunnerOpts): boolean {
    // 异步执行，立即返回 true
    void this._runAsync(sessionId, opts)
    return true
  }

  async requestSync(_tenantId: number, _userId: number): Promise<boolean> {
    // 后台异步扫描，立即返回避免请求阻塞
    void discoverRunners().then((runners) => {
      this.cachedRunners = runners
      logger.info(
        `本机 runner 重新扫描: ${runners.map((e) => e.name).join(', ') || '(无)'}`
      )
      clawEventBus.emit('runtime:runnersChanged', {
        runtimeId: 0,
        runtimeTitle: config.lang !== 'en-US' ? '本机' : 'Local',
      })
    })
    return true
  }

  async setRunnerEnable(
    name: string,
    enable: boolean,
    tenantId: number,
    userId: number
  ): Promise<void> {
    const enableMap = await this._loadEnableMap(tenantId, userId)
    enableMap[name] = enable
    await setParam(
      tenantId,
      userId,
      LOCAL_RUNTIME_PARAM_KEY,
      JSON.stringify(enableMap)
    )
  }

  /** 返回已缓存的 runner 列表（含用户 enable 状态） */
  async getRunners(tenantId: number, userId: number): Promise<RunnerInfo[]> {
    const row = await this.getRuntimeRow(tenantId, userId)
    try {
      return JSON.parse(row.runners ?? '[]')
    } catch {
      return []
    }
  }

  // ── private ──────────────────────────────────────────────────────────────

  private async _loadEnableMap(
    tenantId: number,
    userId: number
  ): Promise<Record<string, boolean>> {
    const raw = await getParam(tenantId, userId, LOCAL_RUNTIME_PARAM_KEY, '')
    if (!raw) return {}
    try {
      return JSON.parse(raw)
    } catch {
      return {}
    }
  }

  private async _runAsync(
    sessionId: string,
    opts: SendRunRunnerOpts
  ): Promise<void> {
    // 延迟 import 避免循环依赖（runtime.ts → websocket/runtime ← localController → runtime.ts）
    const { getClawRuntimeWs } = await import('../index.js')
    const { runRunnerTool } = await import('../connect/index.js')
    const runtimeWs = getClawRuntimeWs()

    // 注入 started 事件
    runtimeWs.emitSessionEvent(sessionId, { type: 'started', sessionId })

    try {
      const result = await runRunnerTool({
        name: opts.name,
        prompt: opts.prompt,
        cwd: opts.cwd,
        sessionContinueId: opts.sessionContinueId,
        agentLogger: opts.agentLogger,
        onProgress: (msg) => {
          const progressType = msg.stageEvent
            ? _stageEventToProgressType(msg.stageEvent)
            : msg.contentType === 'prompt'
              ? 'prompt'
              : msg.contentType === 'think'
                ? 'think'
                : 'message'
          runtimeWs.emitSessionEvent(sessionId, {
            type: 'progress',
            sessionId,
            progressType,
            message: msg.content,
            level: msg.level as any,
            source: msg.source,
            ...(msg.stageEvent
              ? {
                  fileOp: msg.stageEvent.type === 'start' ? 'start' : 'end',
                  fileSuccess: msg.stageEvent.success,
                }
              : {}),
          })
        },
      })

      // 生成 git diff（含新建文件）：遍历 codespace 下各 git 仓库子目录
      // 对每个仓库：stage all → diff --cached → reset，结果以 JSON map 发送
      try {
        const cwd = opts.cwd ?? process.cwd()
        let repoDirs: { name: string; path: string }[]
        try {
          const entries = readdirSync(cwd, { withFileTypes: true })
          const gitSubdirs = entries
            .filter((e) => e.isDirectory())
            .filter((e) => existsSync(path.join(cwd, e.name, '.git')))
          if (gitSubdirs.length > 0) {
            // 有子仓库时扫描子仓库；若 cwd 本身也是 git 仓库则一并包含
            repoDirs = gitSubdirs.map((e) => ({
              name: e.name,
              path: path.join(cwd, e.name),
            }))
            if (existsSync(path.join(cwd, '.git'))) {
              repoDirs.unshift({ name: '<codespace>', path: cwd })
            }
          } else {
            repoDirs = [{ name: '<codespace>', path: cwd }]
          }
        } catch {
          repoDirs = [{ name: '<codespace>', path: cwd }]
        }
        const diffs: Record<string, string> = {}
        for (const repo of repoDirs) {
          spawnSync('git', ['add', '-A'], {
            cwd: repo.path,
            encoding: 'utf8',
            timeout: 10_000,
          })
          const diffResult = spawnSync('git', ['diff', '--cached'], {
            cwd: repo.path,
            encoding: 'utf8',
            timeout: 10_000,
          })
          spawnSync('git', ['reset', 'HEAD', '--', '.'], {
            cwd: repo.path,
            encoding: 'utf8',
            timeout: 10_000,
          })
          const content =
            diffResult.status === 0 ? (diffResult.stdout ?? '') : ''
          if (content.trim()) {
            diffs[repo.name] = content
          }
        }
        if (Object.keys(diffs).length > 0) {
          const totalChars = Object.values(diffs).reduce(
            (s, d) => s + d.length,
            0
          )
          runtimeWs.emitSessionEvent(sessionId, {
            type: 'progress',
            sessionId,
            progressType: 'diff',
            message: JSON.stringify(diffs),
          })
          logger.info(
            `[local] diff sent: ${Object.keys(diffs).length} repos, ${totalChars} chars total`
          )
        }
      } catch {
        // git diff 失败时静默忽略（非 git 目录等情况）
      }

      runtimeWs.emitSessionEvent(sessionId, {
        type: 'success',
        sessionId,
        message: result,
      })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      runtimeWs.emitSessionEvent(sessionId, {
        type: 'fail',
        sessionId,
        message: msg,
      })
    }
  }
}

function _stageEventToProgressType(stageEvent: {
  type: string
  title: string
}): 'fileRead' | 'fileWrite' | 'other' {
  const t = stageEvent.title
  if (t.startsWith('读取文件') || t.startsWith('Read file')) return 'fileRead'
  if (t.startsWith('写入文件') || t.startsWith('Write file')) return 'fileWrite'
  return 'other'
}

export const localRuntimeController = new LocalRuntimeController()
