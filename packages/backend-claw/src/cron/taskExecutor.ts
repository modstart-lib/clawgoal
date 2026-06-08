/**
 * Task Executor — 直接从 claw_task 中拉取 ready 状态任务执行。
 *
 * 并发控制：同一 project_id 下同时只执行一个任务（project 级别并发=1）；
 *           无 project_id 时按 agent 维度控制。
 * 执行流程：
 *   1. 轮询（10s）+ 事件驱动（task:updated status=ready）
 *   2. 查找 ready 且有 agent_id 的 claw_task，按 project/agent 维度过滤已运行的
 *   3. 将 claw_task 状态改为 running
 *   4. 通过 message:incoming 事件触发 gateway 执行 agent loop
 *   5. 监听 message:outgoing 回填结果，更新 claw_task 状态
 */

import { agentManager } from '../agent/index.js'
import { clawEventBus } from '../kernel/eventBus.js'
import { createLogger } from '../kernel/logger.js'
import { clawDb } from '../storage/store/index.js'
import { createNewSession } from '../storage/sessionManager.js'
import { clawMessage } from '../types/index.js'
import { safeJsonParse } from '../../../backend/src/utils/json.js'
import { modelCall } from '../../../backend/src/model/model/index.js'
import { getModelConfigList } from '../../../backend/src/config/index.js'

const logger = createLogger('task-executor')

const POLL_INTERVAL_MS = 10_000

/** taskId → true，记录当前正在执行的任务 */
const runningTasks = new Set<number>()

/** agentId → taskId，用于 message:outgoing 回调时定位 */
const agentRunningTask = new Map<number, number>()

/** taskId → 元数据，供结果提取使用 */
const taskMeta = new Map<
  number,
  {
    title: string
    description: string | null
    tenantId: number
    userId: number
  }
>()

let executing = false
let pendingExecute = false

async function executeReadyTasks(): Promise<void> {
  if (executing) {
    pendingExecute = true
    return
  }
  executing = true
  try {
    await _doExecute()
  } finally {
    executing = false
    if (pendingExecute) {
      pendingExecute = false
      executeReadyTasks().catch((err) => {
        logger.error({ err }, 'executor: error in pending execute')
      })
    }
  }
}

async function _doExecute(): Promise<void> {
  let readyTasks
  try {
    readyTasks = clawDb.findReadyTasksWithAgent()
  } catch (err) {
    logger.error({ err }, 'executor: findReadyTasksWithAgent failed')
    return
  }

  if (readyTasks.length === 0) return

  const activeAgents = agentManager.listActive()
  const activeById = new Map(activeAgents.map((a) => [a.id, a]))

  const dispatchedProjects = new Set<string>()

  for (const task of readyTasks) {
    // 跳过已在本次轮次中派发的
    if (runningTasks.has(task.id)) continue

    const projectKey =
      task.project_id != null
        ? String(task.project_id)
        : `agent:${task.agent_id}`

    if (dispatchedProjects.has(projectKey)) continue

    // 按 project 维度检查是否有其他任务正在运行
    if (
      task.project_id != null &&
      clawDb.hasRunningTaskForProject(task.project_id)
    ) {
      logger.debug(
        `executor: project_id=${task.project_id} already has running task, skip task id=${task.id}`
      )
      continue
    }

    // 按 agent 维度检查（无 project_id 时）
    if (task.project_id == null && agentRunningTask.has(task.agent_id!)) {
      logger.debug(
        `executor: agent_id=${task.agent_id} already running, skip task id=${task.id}`
      )
      continue
    }

    const agent = activeById.get(task.agent_id!)
    if (!agent) {
      logger.debug(
        `executor: agent id=${task.agent_id} not active, skip task id=${task.id}`
      )
      continue
    }

    dispatchedProjects.add(projectKey)

    logger.info(`executor: executing task id=${task.id} agent="${agent.title}"`)

    // 清空旧日志，准备新一轮执行
    clawDb.clearTaskLogs(task.id)

    // 创建或复用 session
    let sessionId = task.session_id ?? 0
    if (sessionId === 0) {
      sessionId = createNewSession(
        agent.tenantId,
        agent.userId,
        agent.id,
        0,
        task.title || '',
        task.description || task.title || ''
      )
      clawDb.updateTask(task.id, { sessionId })
      clawDb.updateSessionData(sessionId, {
        taskId: task.id,
        taskMission: task.description || task.title || '',
      })
    }

    // 更新状态为 running
    clawDb.updateTaskStatus(task.id, 'running')
    clawDb.updateTask(task.id, { startAt: new Date().toISOString() })

    clawEventBus.emit('task:updated', { taskId: task.id, status: 'running' })

    // 记录运行状态
    runningTasks.add(task.id)
    agentRunningTask.set(agent.id, task.id)
    taskMeta.set(task.id, {
      title: task.title,
      description: task.description,
      tenantId: agent.tenantId,
      userId: agent.userId,
    })

    const parentTaskId = task.parent_id ?? task.id
    const content = clawMessage.text(
      task.status_remark ?? task.description ?? task.title
    )

    clawEventBus.emit('message:incoming', {
      agentId: agent.id,
      chatId: 0,
      content,
      userId: agent.userId,
      messageId: 0,
      timestamp: new Date(),
      source: 'task_job',
      sessionId,
      channelId: 0,
      taskId: parentTaskId,
    })
  }
}

/** 使用 LLM 提取任务结果摘要 */
async function extractTaskResult(
  taskId: number,
  title: string,
  description: string | null,
  reply: string,
  tenantId: number,
  userId: number
): Promise<void> {
  try {
    const summaryResult = await modelCall({
      tenantId,
      userId,
      biz: 'Claw',
      bizId: String(taskId),
      modelConfigList: await getModelConfigList(userId, tenantId, 'default'),
      systemPrompt:
        'You are a task result extractor. Based on the task information and agent execution output, extract a concise task result summary. Keep it under 500 characters. Focus on what was actually accomplished.',
      userPrompt: `Task Title: ${title}\n${description ? `Task Description: ${description}\n` : ''}Execution Output:\n${reply.slice(0, 4000)}`,
      temperature: 0.3,
      maxRetry: 1,
    })
    const extracted = summaryResult.type === 'text' ? summaryResult.content : ''
    if (extracted) {
      clawDb.updateTask(taskId, { result: extracted })
      clawEventBus.emit('task:updated', { taskId, status: 'success' })
    }
  } catch (err) {
    logger.warn({ err }, `extractTaskResult: failed for task id=${taskId}`)
  }
}

let intervalHandle: ReturnType<typeof setInterval> | null = null

export function startTaskExecutor(): void {
  if (intervalHandle !== null) {
    logger.warn('executor: already running, ignoring duplicate start')
    return
  }

  intervalHandle = setInterval(() => {
    executeReadyTasks().catch((err) => {
      logger.error({ err }, 'executor: error in executeReadyTasks')
    })
  }, POLL_INTERVAL_MS)

  // 监听 task:updated，任务变为 ready 时立即尝试执行
  clawEventBus.on('task:updated', (evt) => {
    if (evt.status === 'ready') {
      if (evt.taskId) clawDb.checkAndPromoteQueuedChildren(evt.taskId)
      executeReadyTasks().catch((err) => {
        logger.error({ err }, 'executor: error on task:updated ready')
      })
    }
    if (evt.status === 'success' || evt.status === 'failed') {
      executeReadyTasks().catch(() => {})
    }
  })

  // 监听 tool:progress，实时更新 task.processing 和 task.logs
  clawEventBus.on('tool:progress', (evt) => {
    const taskId = agentRunningTask.get(evt.agentId)
    if (!taskId) return

    const processing = evt.stepTitle
      ? `${evt.stepTitle}${evt.stepContent ? ': ' + evt.stepContent.slice(0, 200) : ''}`
      : (evt.stepContent?.slice(0, 200) ?? '')

    clawDb.updateTask(taskId, { processing })
    clawEventBus.emit('task:updated', { taskId, processing })

    if (processing) {
      clawDb.appendTaskLog(taskId, processing)
    }
  })

  // 监听 task:paused — asks tool 暂停执行
  clawEventBus.on('task:paused', (evt) => {
    const taskId = agentRunningTask.get(evt.agentId)
    if (!taskId) return
    logger.info(`executor: task id=${taskId} paused waiting for user input`)
    agentRunningTask.delete(evt.agentId)
    runningTasks.delete(taskId)
    taskMeta.delete(taskId)
  })

  // 监听 message:outgoing (task_job) — agent loop 执行完成
  clawEventBus.on('message:outgoing', async (evt) => {
    if (evt.source !== 'task_job') return
    const taskId = agentRunningTask.get(evt.agentId)
    if (!taskId) return

    const reply = evt.content.text ?? ''
    const meta = taskMeta.get(taskId)

    // 清理运行状态
    agentRunningTask.delete(evt.agentId)
    runningTasks.delete(taskId)
    taskMeta.delete(taskId)

    if (evt.isError) {
      logger.error(`executor: task id=${taskId} failed: ${reply}`)
      clawDb.updateTaskStatus(taskId, 'failed', reply)
      clawDb.updateTask(taskId, {
        result: reply,
        processing: null,
        endAt: new Date().toISOString(),
      })
      clawEventBus.emit('task:updated', { taskId, status: 'failed' })
      clawDb.checkAndPromoteQueuedSiblings(taskId)
      executeReadyTasks().catch(() => {})
      return
    }

    logger.info(
      `executor: task id=${taskId} completed, replyLen=${reply.length}`
    )
    clawDb.updateTaskStatus(taskId, 'success', null)
    clawDb.updateTask(taskId, {
      result: reply,
      processing: null,
      endAt: new Date().toISOString(),
    })
    clawEventBus.emit('task:updated', { taskId, status: 'success' })

    // 将子任务结果写入父任务 shared_content
    const completedTask = clawDb.findTaskById(taskId)
    if (completedTask && completedTask.parent_id) {
      const parent = clawDb.findTaskById(completedTask.parent_id)
      if (parent) {
        let sc: Record<string, unknown> = {}
        sc = safeJsonParse(
          parent.shared_content,
          {},
          'taskExecutor.sharedContent'
        )
        sc[String(taskId)] = reply.slice(0, 2000)
        clawDb.updateTask(completedTask.parent_id, { sharedContent: sc })
      }
    }

    clawDb.checkAndPromoteQueuedSiblings(taskId)
    clawDb.checkAndAutoCompleteParent(taskId)

    executeReadyTasks().catch(() => {})

    if (meta) {
      extractTaskResult(
        taskId,
        meta.title,
        meta.description,
        reply,
        meta.tenantId,
        meta.userId
      ).catch((err) => {
        logger.warn({ err }, `extractTaskResult failed for task id=${taskId}`)
      })
    }
  })

  logger.info(`executor: started (poll every ${POLL_INTERVAL_MS / 1000}s)`)
}

export function stopTaskExecutor(): void {
  if (intervalHandle !== null) {
    clearInterval(intervalHandle)
    intervalHandle = null
    logger.info('executor: stopped')
  }
}
