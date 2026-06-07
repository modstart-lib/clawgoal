/**
 * Claw SQLite 种子数据
 * 使用 better-sqlite3 直接操作 data/db/database.db，与 mock 数据保持一致
 * 供 seed/index.ts 调用，共享统一的 seed 入口
 */

import { runMigrations } from '../../../../backend/src/storage/migrate.js'
import {
  getSharedDb,
  makeSqlHelper,
} from '../../../../backend/src/storage/sqlite.js'
import { getUser, setUser } from '../../memory/index.js'
import { paramDb } from '../../../../backend/src/storage/store/userParam.js'
import { buildMigrations } from '../sqlite/migrate.js'
import { buildInitSql } from '../sqlite/schema.js'
import { taskJobs } from './data/task_jobs.js'
import { agents } from './data/agent.js'
import { channels } from './data/channel.js'
import { tasks as clawTasks } from './data/clawTask.js'
import { cronLogs, cronTasks } from './data/cron.js'
import { mcps } from './data/mcp.js'
import { dailyStats } from './data/model.js'
import { runtimes } from './data/runtime.js'
import { objectiveActions, objectives } from './data/objective.js'
import { metricDefs, metricItems } from './data/metric.js'
import { notes } from './data/note.js'
import { projects } from './data/project.js'
import { projectTodos } from './data/projectTodo.js'
import { wikis } from './data/wiki.js'

/** 将 agent mock id ('agent-001') 映射为数字 id (从 2 开始，跳过 supervisor id=1) */
function agentMockIdToNumeric(
  mockId: string | null | undefined
): number | null {
  if (!mockId) return null
  const match = mockId.match(/(\d+)$/)
  if (!match) return null
  return parseInt(match[1], 10) + 1
}

/** 将 claw_task mock status 映射为 DB status */
function mapClawTaskStatus(s: string): string {
  const m: Record<string, string> = {
    success: 'success',
    successChecking: 'success',
    running: 'draft',
    pending: 'draft',
    asking: 'asking',
    fail: 'failed',
    failed: 'failed',
    canceled: 'canceled',
    queue: 'queue',
    draft: 'draft',
  }
  return m[s] ?? 'draft'
}

/** 打开或创建 Claw SQLite 数据库，初始化表结构 */
async function openClawDb() {
  const db = getSharedDb()
  db.exec(buildInitSql())

  await runMigrations(buildMigrations(db))

  return db
}

export interface ClawSeedCounts {
  agents: number
  channels: number
  mcps: number
  runtimes: number
  cronTasks: number
  cronLogs: number
  clawTasks: number
  clawSubTasks: number
  objProjects: number
  objItems: number
  projects: number
  events: number
  todos: number
  notes: number
  wikis: number
  modelLogs: number
  metric: number
  metricItems: number
}

/**
 * 创建 Claw 演示数据，返回各表插入数量
 */
export async function createClawDemoData(): Promise<ClawSeedCounts> {
  const db = await openClawDb()
  const prep = makeSqlHelper(db, (q) => q)

  let cronCount = 0
  let cronLogCount = 0
  let objItemCount = 0
  let eventCount = 0
  let modelLogCount = 0

  // ── MCPs ──────────────────────────────────────────────────────────────────
  const insertMcp = prep(`
      INSERT OR REPLACE INTO claw_mcp
        (id, created_at, updated_at, tenant_id, user_id, name, title, type, enable, config, status, description)
      VALUES
        ($id, $createdAt, $createdAt, 1, 1, $name, $title, $type, $enable, $config, $status, $description)
    `)
  for (const m of mcps) {
    insertMcp.run({
      id: m.id,
      createdAt: m.createdAt,
      name: m.name,
      title: m.title,
      type: m.type,
      enable: m.enable,
      config: m.config,
      status: m.status,
      description: m.description ?? null,
    })
  }

  // ── Channels ──────────────────────────────────────────────────────────────
  const insertChannel = prep(`
      INSERT OR REPLACE INTO claw_channel
        (id, created_at, updated_at, title, enable, is_global, type, config, status)
      VALUES
        ($id, $createdAt, $createdAt, $title, $enable, $isGlobal, $type, $config, $status)
    `)
  for (const c of channels) {
    insertChannel.run({
      id: c.id,
      createdAt: c.createdAt,
      title: c.title,
      enable: c.enable ? 1 : 0,
      isGlobal: c.isGlobal ? 1 : 0,
      type: c.type,
      config: JSON.stringify(c.config),
      status: c.status,
    })
  }

  // ── Agents ───────────────────────────────────────────────────────────────
  const insertAgent = prep(`
      INSERT OR REPLACE INTO claw_agent
        (id, created_at, updated_at, title, role_name, is_system, enable, status, description, avatar, config, project_id)
      VALUES
        ($id, $createdAt, $createdAt, $title, $roleName, 0, 1, $status, $description, $avatar, $config, $projectId)
    `)
  for (const w of agents) {
    insertAgent.run({
      id: w.id,
      createdAt: w.createdAt,
      title: w.title,
      roleName: w.roleName,
      status: w.workStatus === 'working' ? 'working' : 'idle',
      description: w.description ?? null,
      avatar: w.avatar ?? null,
      config: w.config ? JSON.stringify(w.config) : null,
      projectId: (w as any).projectId ?? null,
    })
  }

  // ── Runtimes ─────────────────────────────────────────────
  const insertRuntime = prep(`
      INSERT OR REPLACE INTO claw_runtime
        (id, created_at, updated_at, name, title, token, status, active_at)
      VALUES
        ($id, $createdAt, $updatedAt, $name, $title, $token, $status, $activeAt)
    `)
  for (const c of runtimes) {
    insertRuntime.run({
      id: c.id,
      createdAt: c.created_at,
      updatedAt: c.updated_at,
      name: c.name,
      title: c.title,
      token: c.token,
      status: c.status,
      activeAt: c.active_at ?? null,
    })
  }

  // ── Cron Tasks ────────────────────────────────────────────────────────────
  const insertCron = prep(`
      INSERT OR REPLACE INTO claw_cron
        (id, created_at, updated_at, title, cron, enable, agent_id, description,
         prompt, last_run_at, next_run_at, last_status, run_once, should_run, success_notify)
      VALUES
        ($id, $createdAt, $createdAt, $title, $cron, $enable, $agentId, $description,
         '', $lastRunAt, $nextRunAt, $lastStatus, 0, 0, $successNotify)
    `)
  for (const t of cronTasks) {
    const agentId = agentMockIdToNumeric(t.agentId as string | null)
    if (agentId === null) {
      // claw_cron.agent_id NOT NULL，跳过没有 agentId 的任务
      continue
    }
    insertCron.run({
      id: t.id,
      createdAt: t.createdAt,
      title: t.name,
      cron: t.cron,
      enable: t.status === 'enabled' ? 1 : 0,
      agentId,
      description: t.description ?? null,
      lastRunAt: t.lastRun ?? null,
      nextRunAt: t.nextRun ?? null,
      lastStatus: null,
      successNotify: (t as any).successNotify ? 1 : 0,
    })
    cronCount++
  }

  // ── Cron Logs ─────────────────────────────────────────────────────────────
  const insertCronLog = prep(`
      INSERT OR REPLACE INTO claw_cron_log
        (id, created_at, updated_at, agent_id, cron_id, title, start_at, end_at, status, status_remark)
      VALUES
        ($id, $createdAt, $updatedAt, $agentId, $cronId, $title, $startAt, $endAt, $status, $statusRemark)
    `)
  const seededCronIds = new Set(
    cronTasks
      .filter((t) => agentMockIdToNumeric(t.agentId as string | null) !== null)
      .map((t) => t.id)
  )
  for (const [cronIdStr, logs] of Object.entries(cronLogs)) {
    const cronId = Number(cronIdStr)
    if (!seededCronIds.has(cronId)) continue // 跳过未插入的 cron 任务的日志
    const cron = cronTasks.find((t) => t.id === cronId)
    const agentId = cron
      ? agentMockIdToNumeric(cron.agentId as string | null)
      : null
    for (const log of logs) {
      insertCronLog.run({
        id: log.id,
        createdAt: log.time,
        updatedAt: log.time,
        agentId: agentId ?? null,
        cronId,
        title: cron?.name ?? '定时任务',
        startAt: log.time,
        endAt: log.time,
        status: log.success ? 'success' : 'error',
        statusRemark: log.message ?? null,
      })
      cronLogCount++
    }
  }

  // ── Claw Tasks ────────────────────────────────────────────────────────────
  // agentId (1-based after offset) → projectId mapping
  const agentProjectMap: Record<number, number> = {
    2: 1, // 李白 → project 1
    3: 2, // 鲁班 → project 2
    4: 3, // 鬼谷子 → project 3
    5: 1, // 上官婉儿 → project 1
  }
  const insertTask = prep(`
      INSERT OR REPLACE INTO claw_task
        (id, created_at, updated_at, agent_id, start_at, end_at, status, status_remark, title, description, processing, key_result_id, source, parent_id, root_id, needs, project_id)
      VALUES
        ($id, $createdAt, $updatedAt, $agentId, $startAt, $endAt, $status, $statusRemark, $title, $description, $processing, $keyResultId, $source, $parentId, $rootId, $needs, $projectId)
    `)
  for (const t of clawTasks) {
    const mappedAgentId = t.agentId != null ? t.agentId + 1 : null
    insertTask.run({
      id: t.id,
      createdAt: t.createdAt,
      updatedAt: t.createdAt,
      agentId: mappedAgentId,
      startAt: t.startAt ?? null,
      endAt: t.endAt ?? null,
      status: mapClawTaskStatus(t.status),
      statusRemark: t.statusRemark || null,
      title: t.title,
      description: t.description ?? null,
      processing: t.processing || null,
      keyResultId: (t as any).keyResultId ?? null,
      source: (t as any).source ?? 'manual',
      parentId: (t as any).parentId ?? 0,
      rootId: (t as any).rootId ?? 0,
      needs: JSON.stringify((t as any).needs ?? []),
      projectId:
        (t as any).projectId ??
        (mappedAgentId != null
          ? (agentProjectMap[mappedAgentId] ?? null)
          : null),
    })
  }

  // ── Claw Sub-Tasks (previously task_jobs) ────────────────────────────────
  // 子任务使用 claw_task 表存储，parent_id 指向父任务
  const SUBTASK_ID_OFFSET = 1000 // 避免与顶级任务 id 冲突
  const insertSubTask = prep(`
      INSERT OR REPLACE INTO claw_task
        (id, created_at, updated_at, tenant_id, user_id, agent_id, status, status_remark, title, description, parent_id, source)
      VALUES
        ($id, $createdAt, $createdAt, 1, 1, $agentId, $status, $statusRemark, $title, $description, $parentId, 'manual')
    `)
  for (const a of taskJobs) {
    const parentId = a.taskId > 0 ? a.taskId : null
    const mappedStatus =
      a.status === 'done'
        ? 'success'
        : a.status === 'pending'
          ? 'draft'
          : a.status === 'canceled'
            ? 'failed'
            : a.status
    insertSubTask.run({
      id: SUBTASK_ID_OFFSET + a.id,
      createdAt: a.createdAt,
      agentId: a.agentId + 1,
      status: mappedStatus,
      statusRemark: a.output ?? null,
      title: a.input ?? '',
      description: a.input ?? null,
      parentId,
    })
  }

  // ── Objectives + Actions ───────────────────────────────────────────────────
  const insertObjective = prep(`
      INSERT OR REPLACE INTO claw_objective
        (id, created_at, updated_at, title, description, status, icon, result, project_id, start_at, end_at)
      VALUES
        ($id, $createdAt, $createdAt, $title, $description, $status, $icon, $result, $projectId, $startAt, $endAt)
    `)
  const insertObjectiveAction = prep(`
      INSERT OR REPLACE INTO claw_key_result
        (id, created_at, updated_at, objective_id, title, detail, status)
      VALUES
        ($id, $createdAt, $createdAt, $objectiveId, $title, $detail, $status)
    `)
  for (const o of objectives) {
    insertObjective.run({
      id: o.id,
      createdAt: o.createdAt,
      title: o.title,
      description: o.description ?? null,
      status: o.status,
      icon: o.icon,
      result: o.result ?? null,
      projectId: (o as any).projectId ?? null,
      startAt: o.startAt ?? null,
      endAt: o.endAt ?? null,
    })
  }
  for (const a of objectiveActions) {
    insertObjectiveAction.run({
      id: a.id,
      createdAt: a.createdAt,
      objectiveId: a.objectiveId,
      title: a.title,
      detail: a.detail ?? '',
      status: a.status,
    })
    objItemCount++
  }

  // ── Projects + Events + Revenue ───────────────────────────────────────
  const insertProject = prep(`
      INSERT OR REPLACE INTO claw_project
        (id, created_at, updated_at, title, description, status, color, logo, start_at, due_at)
      VALUES
        ($id, $createdAt, $createdAt, $title, $description, $status, $color, $logo, $startAt, $dueAt)
    `)
  const insertEvent = prep(`
      INSERT OR REPLACE INTO claw_event
        (id, created_at, updated_at, project_id, biz, title, description, day, type)
      VALUES
        ($id, $createdAt, $createdAt, $projectId, $biz, $title, $description, $day, $type)
    `)
  for (const p of projects) {
    insertProject.run({
      id: p.id,
      createdAt: p.createdAt,
      title: p.title,
      description: p.description ?? null,
      status: p.status,
      color: p.color ?? '#6366f1',
      logo: (p as any).logo || null,
      startAt: p.startAt ?? null,
      dueAt: p.dueAt ?? null,
    })
    for (const m of p.events ?? []) {
      insertEvent.run({
        id: m.id,
        createdAt: m.createdAt,
        projectId: m.projectId,
        biz: (m as any).biz?.trim() || null,
        title: m.title,
        description: m.description ?? null,
        day: m.day ?? null,
        type: (m as any).type || null,
      })
      eventCount++
    }
  }

  // ── Project Backlogs (Backlog) ────────────────────────────────────────────────
  const insertTodo = prep(`
      INSERT OR REPLACE INTO claw_backlog
        (id, created_at, updated_at, project_id, title, status, priority, type, due_at, source, reason, active_at, done_at)
      VALUES
        ($id, $createdAt, $createdAt, $projectId, $title, $status, $priority, $type, $dueAt, $source, $reason, $activeAt, $doneAt)
    `)
  for (const todo of projectTodos) {
    insertTodo.run({
      id: todo.id,
      createdAt: todo.createdAt,
      projectId: todo.projectId,
      title: todo.title,
      status: todo.status,
      priority: (todo as any).priority ?? 'medium',
      type: todo.type ?? null,
      dueAt: (todo as any).dueAt ?? null,
      source: (todo as any).source ?? null,
      reason: (todo as any).reason ?? null,
      activeAt: (todo as any).activeAt ?? null,
      doneAt: (todo as any).doneAt ?? null,
    })
  }

  // ── Project Notes ─────────────────────────────────────────────────────────
  const insertNote = prep(`
      INSERT OR REPLACE INTO claw_note
        (id, created_at, updated_at, project_id, biz, type, title, content)
      VALUES
        ($id, $createdAt, $createdAt, $projectId, $biz, $type, $title, $content)
    `)
  for (const note of notes) {
    insertNote.run({
      id: note.id,
      createdAt: note.createdAt,
      projectId: note.projectId,
      biz: (note as any).biz?.trim() || null,
      type: note.type ?? null,
      title: note.title,
      content: note.content ?? null,
    })
  }

  // ── Project Wikis ─────────────────────────────────────────────────────────
  const insertWiki = prep(`
      INSERT OR REPLACE INTO claw_wiki
        (id, created_at, updated_at, project_id, user_id, biz, status, title, content, source_url)
      VALUES
        ($id, $createdAt, $createdAt, $projectId, 1, $biz, 'success', $title, $content, $sourceUrl)
    `)
  for (const wiki of wikis) {
    insertWiki.run({
      id: wiki.id,
      createdAt: wiki.createdAt,
      projectId: wiki.projectId,
      biz: (wiki as any).biz?.trim() || null,
      title: wiki.title,
      content: wiki.content ?? null,
      sourceUrl: wiki.sourceUrl ?? null,
    })
  }

  // ── Model Logs ────────────────────────────────────────────────────────────
  const modelDurations: Record<string, number> = {
    'gpt-4o': 3180,
    'claude-3-5-sonnet-20241022': 2740,
    'gpt-4o-mini': 980,
    'deepseek-chat': 1680,
  }
  const insertModelLog = prep(`
      INSERT INTO model_log
        (created_at, updated_at, user_id, provider, model, message_count,
         prompt_tokens, completion_tokens, total_tokens, duration_ms, status,
         request_body, response_body)
      VALUES
        ($createdAt, $createdAt, 1, $provider, $model, 1,
         $promptTokens, $completionTokens, $totalTokens, $durationMs, 'success',
         $requestBody, $responseBody)
    `)
  for (const stat of dailyStats) {
    const sampleRequest = JSON.stringify({
      model: stat.model,
      messages: [
        { role: 'system', content: 'You are a helpful assistant.' },
        { role: 'user', content: 'Please help me with my task.' },
      ],
      temperature: 0.7,
    })
    const sampleResponse = JSON.stringify({
      content: 'Sure, I can help you with that. Here is my response.',
      usage: {
        input_tokens: stat.total_prompt_tokens,
        output_tokens: stat.total_completion_tokens,
      },
    })
    insertModelLog.run({
      createdAt: `${stat.date} 12:00:00`,
      provider: stat.provider,
      model: stat.model,
      promptTokens: stat.total_prompt_tokens,
      completionTokens: stat.total_completion_tokens,
      totalTokens: stat.total_tokens,
      durationMs: modelDurations[stat.model] ?? 2000,
      requestBody: sampleRequest,
      responseBody: sampleResponse,
    })
    modelLogCount++
  }

  // ── Project Metric ───────────────────────────────────────────────────────
  const insertMetricDef = prep(`
      INSERT OR REPLACE INTO claw_metric
        (id, created_at, updated_at, project_id, name, title, sort)
      VALUES
        ($id, $createdAt, $createdAt, $projectId, $name, $title, $sort)
    `)
  for (const m of metricDefs) {
    insertMetricDef.run({
      id: m.id,
      createdAt: m.createdAt,
      projectId: m.projectId,
      name: m.name,
      title: m.title,
      sort: m.sort,
    })
  }

  const insertMetricItem = prep(`
      INSERT OR REPLACE INTO claw_metric_item
        (id, created_at, updated_at, project_id, day, name, value)
      VALUES
        ($id, $createdAt, $updatedAt, $projectId, $day, $name, $value)
    `)
  for (const item of metricItems) {
    insertMetricItem.run({
      id: item.id,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
      projectId: item.projectId,
      day: item.day,
      name: item.name,
      value: item.value,
    })
  }

  // ── 我的信息（User Memory）────────────────────────────────────────────────
  const existingUser = await getUser(1, 1)
  if (!existingUser) {
    await setUser(1, 1, '我是老板，希望通过开发软件让大家共享AI的生产力红利。')
  }

  // ── 目标设置（Objective Setting）────────────────────────────────────────────
  const existingGoal = await paramDb.getParam(
    1,
    1,
    'claw:objective:setting:goal'
  )
  if (!existingGoal) {
    await paramDb.setParam(
      1,
      1,
      'claw:objective:setting:goal',
      '我是一个独立开发者，正在独立开发一款面向特定用户群的 SaaS 产品，核心目标是完成 MVP 并获得前 100 个付费用户。'
    )
  }

  return {
    agents: agents.length,
    channels: channels.length,
    mcps: mcps.length,
    runtimes: runtimes.length,
    cronTasks: cronCount,
    cronLogs: cronLogCount,
    clawTasks: clawTasks.length,
    clawSubTasks: taskJobs.length,
    objProjects: objectives.length,
    objItems: objItemCount,
    projects: projects.length,
    events: eventCount,
    todos: projectTodos.length,
    notes: notes.length,
    wikis: wikis.length,
    modelLogs: modelLogCount,
    metric: metricDefs.length,
    metricItems: metricItems.length,
  }
}

/**
 * 当 SEED_DATA_INIT=1 且没有非 supervisor agent 时，自动写入 demo 数据。
 * 供 migrate.ts 和 kernel/main.ts 统一调用，与其他模块的 autoXxxSeedIfNeeded 保持一致。
 */
export async function autoClawSeedIfNeeded(): Promise<void> {
  if (process.env.NODE_ENV !== 'development') return
  if (!process.env.SEED_DATA_INIT) return

  try {
    const { getSharedDb } =
      await import('../../../../backend/src/storage/sqlite.js')
    const db = getSharedDb()
    const row = db
      .prepare(
        `SELECT name FROM sqlite_master WHERE type='table' AND name='claw_agent'`
      )
      .get()
    const nonSupervisorCount = row
      ? (
          db
            .prepare(
              `SELECT COUNT(*) as c FROM claw_agent WHERE role_name != 'supervisor'`
            )
            .get() as { c: number }
        ).c
      : 0

    if (nonSupervisorCount > 0) return

    await createClawDemoData()
  } catch (err) {
    // seed 失败不阻断启动
    console.warn('[claw-seed] autoClawSeedIfNeeded failed:', err)
  }
}
