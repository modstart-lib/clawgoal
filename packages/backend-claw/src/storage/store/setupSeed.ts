/**
 * Setup auto-seed
 * Reads data/setup.yaml on startup and imports any channel / agent whose title
 * does not yet exist in the database.
 *
 * The default Supervisor agent is always auto-seeded by the system (is_system=1)
 * and is NOT included in setup.yaml.
 */

import yaml from 'js-yaml'
import fs from 'node:fs'
import { config } from '../../../../backend/src/config'
import { resolvePath } from '../../../../backend/src/config/env.js'
import { resolveAvatar } from '../../assets/avatar.js'
import { createLogger } from '../../kernel/logger.js'
import { clawDb } from './index.js'

const logger = createLogger('setup-seed')

// ─── Types ────────────────────────────────────────────────────────────────────

interface ChannelEntry {
  title: string
  type: 'telegram' | 'feishu'
  enable?: boolean
  config?: {
    token?: string
    chatId?: string
  }
}

interface AgentEntry {
  title: string
  roleName: string
  enable?: boolean
  description?: string
  /** 头像 URL 或 data: URI 或 system:xxx；留空则自动使用角色对应的系统头像 */
  avatar?: string
  /** 圆色参数初始值，对应角色 config.yaml 中定义的 param 字段 */
  param?: Record<string, unknown>
  /** 关联的项目标题，需与 setup.yaml projects 中的 title 一致 */
  projectTitle?: string
}

interface MetricEntry {
  name: string
  title: string
  sort?: number
  remark?: string
}

interface ProjectEntry {
  title: string
  description?: string
  status?: 'planning' | 'active' | 'paused' | 'done'
  color?: string
  /** 自动生成过去 N 天的样本指标数据，0 或不填则不生成 */
  metric_item_days?: number
  metric?: MetricEntry[]
}

interface SetupYaml {
  channels?: ChannelEntry[]
  agents?: AgentEntry[]
  projects?: ProjectEntry[]
  mcps?: McpSeedEntry[]
}

interface McpSeedEntry {
  name: string
  title: string
  type: 'stdio' | 'sse' | 'http'
  enable?: boolean
  description?: string
  config?: Record<string, unknown>
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function loadSetupYaml(): SetupYaml | null {
  const yamlPath = resolvePath('data/setup.yaml')

  if (!fs.existsSync(yamlPath)) {
    logger.debug(`setup.yaml not found at ${yamlPath}, skipping setup seed`)
    return null
  }

  try {
    const raw = fs.readFileSync(yamlPath, 'utf8')
    return (yaml.load(raw) as SetupYaml) ?? {}
  } catch (err) {
    logger.warn({ err }, 'Failed to parse setup.yaml, skipping setup seed')
    return null
  }
}

// ─── Channel seed ─────────────────────────────────────────────────────────────

async function seedChannels(entries: ChannelEntry[]): Promise<void> {
  if (entries.length === 0) {
    logger.debug('setup.yaml has no channels defined, skipping')
    return
  }

  const existing = clawDb.findAllChannels(1, config.supervisorUserId)
  const existingTitles = new Set(existing.map((c) => c.title))

  let imported = 0
  const skipped: string[] = []
  for (const entry of entries) {
    if (!entry.title || !entry.type) {
      logger.warn(
        { entry },
        'setup.yaml channel entry missing required title or type, skipping'
      )
      continue
    }

    if (existingTitles.has(entry.title)) {
      skipped.push(entry.title)
      continue
    }

    clawDb.insertChannel({
      tenantId: 1,
      userId: config.supervisorUserId,
      title: entry.title,
      type: entry.type,
      enable: entry.enable !== false,
      isGlobal: true,
      config: entry.config
        ? { token: entry.config.token, chatId: entry.config.chatId }
        : undefined,
    })

    logger.info(`Auto-imported channel "${entry.title}" (type=${entry.type})`)
    imported++
  }

  if (skipped.length > 0) {
    logger.debug(
      `Channel seed: ${skipped.length} already exist, skipping (${skipped.join(', ')})`
    )
  }
  if (imported > 0) {
    logger.info(`Channel seed completed: ${imported} channel(s) imported`)
  } else if (skipped.length === 0) {
    logger.debug('Channel seed: all channels already exist, nothing imported')
  }
}

// ─── Agent seed ──────────────────────────────────────────────────────────────

async function seedAgents(
  entries: AgentEntry[],
  getRoleAvatar: (roleName: string) => string | undefined
): Promise<void> {
  if (entries.length === 0) {
    logger.debug('setup.yaml has no agents defined, skipping')
    return
  }

  const existing = clawDb.findAll(1, config.supervisorUserId)
  const existingRoleNames = new Set(existing.map((w) => w.role_name))

  let imported = 0
  const skipped: string[] = []
  for (const entry of entries) {
    if (!entry.title || !entry.roleName) {
      logger.warn(
        { entry },
        'setup.yaml agent entry missing required title or roleName, skipping'
      )
      continue
    }

    if (existingRoleNames.has(entry.roleName)) {
      skipped.push(entry.title)
      continue
    }

    // 优先使用 setup.yaml 中声明的 avatar，其次用角色默认 avatar（支持 system:xxx），最后兜底用角色名生成系统头像
    const rawAvatar =
      entry.avatar ||
      getRoleAvatar(entry.roleName) ||
      `system:${entry.roleName}`

    // 解析所属项目 ID
    let projectId: number | undefined
    if (entry.projectTitle) {
      const allProjects = clawDb.findAllProjects(1, config.supervisorUserId)
      const matched = allProjects.find((p) => p.title === entry.projectTitle)
      if (matched) {
        projectId = matched.id
      } else {
        logger.warn(
          { roleName: entry.roleName, projectTitle: entry.projectTitle },
          'setup.yaml agent projectTitle not found, ignoring'
        )
      }
    }

    clawDb.insert({
      tenantId: 1,
      userId: config.supervisorUserId,
      title: entry.title,
      roleName: entry.roleName,
      isSystem: false,
      enable: entry.enable !== false,
      description: entry.description,
      avatar: resolveAvatar(rawAvatar) ?? rawAvatar,
      param: entry.param ?? null,
      projectId,
    })

    logger.info(`Auto-imported agent "${entry.title}" (role=${entry.roleName})`)
    imported++
  }

  if (skipped.length > 0) {
    logger.debug(
      `Agent seed: ${skipped.length} already exist, skipping (${skipped.join(', ')})`
    )
  }
  if (imported > 0) {
    logger.info(`Agent seed completed: ${imported} agent(s) imported`)
  } else if (skipped.length === 0) {
    logger.debug('Agent seed: all agents already exist, nothing imported')
  }
}

// ─── Project & Metric seed ──────────────────────────────────────────────────

/** 生成过去 N 天（不含今天）的日期列表，格式 YYYY-MM-DD，从旧到新 */
function pastDays(n: number): string[] {
  const days: string[] = []
  const now = new Date()
  for (let i = n; i >= 1; i--) {
    const d = new Date(now)
    d.setDate(d.getDate() - i)
    days.push(d.toISOString().slice(0, 10))
  }
  return days
}

/** 简单线性增长 + 随机波动，返回整数 */
function mockSeries(
  days: number,
  base: number,
  growthPerDay: number,
  jitterPct = 0.2
): number[] {
  const results: number[] = []
  let current = base
  for (let i = 0; i < days; i++) {
    const jitter = current * jitterPct * (Math.random() * 2 - 1)
    results.push(Math.max(0, Math.round(current + jitter)))
    current += growthPerDay
  }
  return results
}

/** 每个指标名称对应的样本参数 (base, growthPerDay) */
const METRIC_SAMPLE_PARAMS: Record<string, [number, number]> = {
  mrr: [3000, 50],
  user: [200, 5],
  visit: [800, 10],
  trial: [30, 1],
  article: [2, 0.05],
  follower: [500, 8],
  view: [1500, 20],
}

function getMetricParams(name: string): [number, number] {
  return METRIC_SAMPLE_PARAMS[name] ?? [100, 2]
}

async function seedProjects(entries: ProjectEntry[]): Promise<void> {
  if (entries.length === 0) {
    logger.debug('setup.yaml has no projects defined, skipping')
    return
  }

  const existing = clawDb.findAllProjects(1, config.supervisorUserId)
  const existingTitles = new Set(existing.map((p) => p.title))

  let imported = 0
  const skipped: string[] = []

  for (const entry of entries) {
    if (!entry.title) {
      logger.warn(
        { entry },
        'setup.yaml project entry missing required title, skipping'
      )
      continue
    }

    if (existingTitles.has(entry.title)) {
      skipped.push(entry.title)
      continue
    }

    const project = clawDb.insertProject({
      tenantId: 1,
      userId: config.supervisorUserId,
      title: entry.title,
      description: entry.description,
      status: entry.status ?? 'active',
      color: entry.color ?? '#6366f1',
    })

    logger.info(`Auto-imported project "${entry.title}" (id=${project.id})`)
    imported++

    // Seed metric definitions
    const metricList = entry.metric ?? []
    for (let idx = 0; idx < metricList.length; idx++) {
      const m = metricList[idx]
      if (!m.name || !m.title) {
        logger.warn(
          { m },
          'project metric entry missing name or title, skipping'
        )
        continue
      }
      clawDb.insertMetric({
        projectId: project.id,
        name: m.name,
        title: m.title,
        sort: m.sort ?? idx,
        remark: m.remark,
      })
    }

    // Seed sample metric items
    const daysCount = entry.metric_item_days ?? 0
    if (daysCount > 0 && metricList.length > 0) {
      const dates = pastDays(daysCount)
      for (const m of metricList) {
        if (!m.name) continue
        const [base, growth] = getMetricParams(m.name)
        const values = mockSeries(daysCount, base, growth)
        for (let i = 0; i < dates.length; i++) {
          clawDb.upsertMetricItem({
            projectId: project.id,
            day: dates[i],
            name: m.name,
            value: values[i],
          })
        }
      }
      logger.info(
        `Seeded ${daysCount} days of sample metric items for project "${entry.title}"`
      )
    }
  }

  if (skipped.length > 0) {
    logger.debug(
      `Project seed: ${skipped.length} already exist, skipping (${skipped.join(', ')})`
    )
  }
  if (imported > 0) {
    logger.info(`Project seed completed: ${imported} project(s) imported`)
  }
}

// ─── MCP seed ─────────────────────────────────────────────────────────────────

async function seedMcps(entries: McpSeedEntry[]): Promise<void> {
  if (entries.length === 0) return

  let imported = 0
  const skipped: string[] = []

  for (const entry of entries) {
    if (!entry.name || !entry.title || !entry.type) {
      logger.warn(
        { entry },
        'setup.yaml mcp entry missing required fields, skipping'
      )
      continue
    }

    const existing = clawDb.findMcpByName(
      1,
      config.supervisorUserId,
      entry.name
    )
    if (existing) {
      skipped.push(entry.name)
      continue
    }

    clawDb.insertMcp({
      tenantId: 1,
      userId: config.supervisorUserId,
      name: entry.name,
      title: entry.title,
      type: entry.type,
      enable: entry.enable !== false,
      description: entry.description,
      config: entry.config as any,
    })

    logger.info(`Auto-imported MCP "${entry.title}" (name=${entry.name})`)
    imported++
  }

  if (skipped.length > 0) {
    logger.debug(
      `MCP seed: ${skipped.length} already exist, skipping (${skipped.join(', ')})`
    )
  }
  if (imported > 0) {
    logger.info(`MCP seed completed: ${imported} MCP(s) imported`)
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Read setup.yaml from the data directory (relative to cwd) and import any
 * channel / agent / project whose title does not already exist in the database.
 */
export async function seedSetup(
  getRoleAvatar: (roleName: string) => string | undefined = () => undefined
): Promise<void> {
  const doc = loadSetupYaml()
  if (!doc) return

  await seedAgents(doc.agents ?? [], getRoleAvatar)
  await seedChannels(doc.channels ?? [])
  await seedProjects(doc.projects ?? [])
  await seedMcps(doc.mcps ?? [])
}
