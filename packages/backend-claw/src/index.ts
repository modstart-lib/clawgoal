import express, { type Router } from 'express'
import { config } from '../../backend/src/config/index.js'
import { logger } from '../../backend/src/utils/logger.js'
import agentRouter from './api/routes/agent.js'
import channelConfigRouter from './api/routes/channel.js'
import clawConfigRouter from './api/routes/config.js'
import runtimeRouter from './api/routes/runtime.js'
import cronRouter from './api/routes/cron.js'
import hookRouter from './api/routes/hook.js'
import mcpRouter from './api/routes/mcp.js'
import memoryRouter from './api/routes/memory.js'
import objectiveRouter from './api/routes/objective.js'
import projectRouter from './api/routes/project.js'
import eventRouter from './api/routes/event.js'
import metricRouter from './api/routes/metric.js'
import noteRouter from './api/routes/note.js'
import backlogRouter from './api/routes/backlog.js'
import wikiRouter from './api/routes/wiki.js'
import skillsRouter from './api/routes/skill.js'
import agentAuditRouter from './api/routes/agentAudit.js'
import agentToolRouter from './api/routes/agentTool.js'
import clawTaskRouter from './api/routes/task.js'
import toolsRouter from './api/routes/tools.js'
import agentSessionRouter from './api/routes/agentSession.js'
import agentWorkflowRouter from './api/routes/agentWorkflow.js'
import mockRouter from './api/routes/mock.js'
import { agentManager } from './agent/index.js'
import { channelManager } from './channel/manager.js'
import { createChannelWebhookRouter } from './channel/webhookRouter.js'
import { initRuntimeListener } from './connect/listener.js'
import { cronManager } from './cron/index.js'
import { initCronListener } from './cron/listener.js'
import { startTaskExecutor } from './cron/taskExecutor.js'
import { initWikiSync } from './cron/wikiSync.js'
import { mcpManager } from './mcp/manager.js'
import { localRuntimeController } from './runtime/localController.js'
import { skillRegistry } from './skills/index.js'
import { initAgentLog } from './storage/store/agentLog.js'
import { clawDb } from './storage/store/index.js'
import { seedSetup } from './storage/store/setupSeed.js'
import { autoClawSeedIfNeeded } from './storage/seed/index.js'
import { seedBuiltinSkills } from './kernel/main.js'
import { clawEventBus } from './kernel/eventBus.js'
import { paramDb } from '../../backend/src/storage/store/userParam.js'
import { AgentWebsocketService } from './channel/web/server.js'
import { RuntimeWebsocketService } from './websocket/runtime.js'

export function useClawDb() {
  return clawDb
}

export function useClawAutoSeed() {
  return {
    autoClawSeedIfNeeded: () =>
      import('./storage/seed/index.js').then((m) => m.autoClawSeedIfNeeded()),
  }
}

export function useClaw() {
  async function initClaw() {
    const defaultModel = config.model['claw']?.[0]?.nameRef ?? 'default'

    // Open SQLite store before any storage operations
    await clawDb.open()
    clawDb.resetAllRuntimesToOffline()
    initAgentLog()

    // Open param store so getParam/setParam work within the claw bundle
    await paramDb.open()

    // 扫描本机可用 runner（需在 paramDb.open() 之后）
    await localRuntimeController.init()

    // Seed built-in skills into data/skills/ (full overwrite on every startup)
    await seedBuiltinSkills()

    // Load skills from data/skills/
    await skillRegistry.loadAll()

    // Initialize MCP server connections defined in DB
    await mcpManager.init()

    // Initialize agent manager: loads roles, auto-seeds supervisor, loads DB agents
    await agentManager.init(defaultModel)
    logger.info(
      `Available roles: ${agentManager
        .listRoles()
        .map((r) => r.name)
        .join(', ')}`
    )

    // SEED_DATA_INIT=1: 测试/演示模式下自动写入 demo 数据
    await autoClawSeedIfNeeded()

    // Auto-import agents/channels from data/setup.yaml
    await seedSetup((roleName) => agentManager.getRole(roleName)?.avatar)

    // Reload agents from DB so seed changes are immediately active
    agentManager.reloadFromDb()
    logger.info(agentManager.statusLine())

    // Start channel-based connections
    await channelManager.startAll()

    // Start schedulers
    initCronListener()
    initRuntimeListener()
    await cronManager.load()
    cronManager.start()
    initWikiSync()
    startTaskExecutor()

    logger.info('Claw module initialized')
    for (const line of channelManager.healthReport().split('\n')) {
      logger.info(line)
    }
  }

  return { initClaw }
}

export function useClawRouter(): Router {
  const router = express.Router()

  const clawRouter = express.Router()
  clawRouter.use(agentRouter)
  clawRouter.use(toolsRouter)
  clawRouter.use(clawTaskRouter)
  clawRouter.use(cronRouter)
  clawRouter.use(skillsRouter)
  clawRouter.use(mcpRouter)
  clawRouter.use(runtimeRouter)
  clawRouter.use(objectiveRouter)
  clawRouter.use(projectRouter)
  clawRouter.use(eventRouter)
  clawRouter.use(metricRouter)
  clawRouter.use(noteRouter)
  clawRouter.use(backlogRouter)
  clawRouter.use(wikiRouter)
  clawRouter.use(memoryRouter)
  clawRouter.use(clawConfigRouter)
  clawRouter.use(agentSessionRouter)
  clawRouter.use(agentWorkflowRouter)
  clawRouter.use(mockRouter)
  clawRouter.use(agentAuditRouter)
  clawRouter.use(agentToolRouter)
  router.use(clawRouter)
  router.use('/hook', hookRouter)
  router.use(createChannelWebhookRouter())

  return router
}

let _clawWs: {
  agent: AgentWebsocketService
  runtime: RuntimeWebsocketService
} | null = null
export function useClawWebSocket() {
  if (!_clawWs)
    _clawWs = {
      agent: new AgentWebsocketService(),
      runtime: getClawRuntimeWs(),
    }
  return _clawWs
}

/**
 * Provides claw-specific config routes (channel CRUD).
 * Mount this in the shared backend api router when TYPE_CLAW is active.
 */
export function useClawConfigRouter(): Router {
  const router = express.Router()
  router.use(channelConfigRouter)
  return router
}

let _runtimeWs: RuntimeWebsocketService | null = null

export function getClawRuntimeWs(): RuntimeWebsocketService {
  if (!_runtimeWs) _runtimeWs = new RuntimeWebsocketService()
  return _runtimeWs
}

export function initClawSystemEvents(system: {
  broadcastEvent: (name: string, data?: Record<string, unknown>) => void
}): void {
  clawEventBus.on('runtime:connected', (evt) => {
    system.broadcastEvent('claw:runtime:updated', { runtimeId: evt.runtimeId })
  })
  clawEventBus.on('runtime:disconnected', (evt) => {
    system.broadcastEvent('claw:runtime:updated', { runtimeId: evt.runtimeId })
  })
  clawEventBus.on('runtime:runnersChanged', (evt) => {
    system.broadcastEvent('claw:runtime:runnersUpdated', {
      runtimeId: evt.runtimeId,
    })
  })
  clawEventBus.on('mcp:connected', (evt) => {
    system.broadcastEvent('claw:mcp:updated', { mcpId: evt.mcpId })
  })
  clawEventBus.on('mcp:disconnected', (evt) => {
    system.broadcastEvent('claw:mcp:updated', { mcpId: evt.mcpId })
  })

  // 相同事件名+参数 1 秒内去重，只广播一次
  const broadcastTimers = new Map<string, ReturnType<typeof setTimeout>>()
  const debouncedBroadcast = (name: string, data?: Record<string, unknown>) => {
    const key = name + JSON.stringify(data ?? {})
    const existing = broadcastTimers.get(key)
    if (existing) clearTimeout(existing)
    const timer = setTimeout(() => {
      broadcastTimers.delete(key)
      system.broadcastEvent(name, data)
    }, 1000)
    broadcastTimers.set(key, timer)
  }

  clawEventBus.on('agent:updated', (evt) => {
    debouncedBroadcast('claw:agent:updated', { agentId: evt.agentId })
  })

  clawEventBus.on('task:updated', (evt) => {
    const payload = {
      taskId: evt.taskId,
      status: evt.status,
      processing: evt.processing,
    }
    debouncedBroadcast('claw:task:updated', payload)
    debouncedBroadcast(`claw:task:${evt.taskId}:changed`, {
      taskId: evt.taskId,
    })
    const task = clawDb.findTaskById(evt.taskId)
    if (task && task.root_id > 0 && task.root_id !== evt.taskId) {
      debouncedBroadcast(`claw:task:${task.root_id}:changed`, {
        taskId: evt.taskId,
      })
    }
  })
}
