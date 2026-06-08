/**
 * Project Summary Generator
 *
 * Aggregates project information for use in AI prompts:
 *   - Project name, description, status
 *   - Recent 6-month events list
 *   - Metric summary table (last 7d / this month / last month / quarter / this year / last year)
 *   - Requirements list grouped by priority
 */

import { clawDb } from '../storage/store/index.js'

type Lang = 'en' | 'zh'

interface MetricDef {
  name: string
  title: string
  summary_mode?: string
}

function getDateRanges(now: Date) {
  const today = now.toISOString().slice(0, 10)
  const y = now.getFullYear()
  const m = now.getMonth() // 0-indexed

  // last 7 days
  const d7 = new Date(now)
  d7.setDate(d7.getDate() - 6)
  const last7Start = d7.toISOString().slice(0, 10)

  // this month
  const thisMonthStart = `${y}-${String(m + 1).padStart(2, '0')}-01`
  const thisMonthEnd = today

  // last month
  const lm = m === 0 ? 11 : m - 1
  const lmYear = m === 0 ? y - 1 : y
  const lastMonthStart = `${lmYear}-${String(lm + 1).padStart(2, '0')}-01`
  const lastMonthEnd = new Date(y, m, 0).toISOString().slice(0, 10)

  // current quarter
  const qMonth = Math.floor(m / 3) * 3
  const quarterStart = `${y}-${String(qMonth + 1).padStart(2, '0')}-01`
  const quarterEnd = today

  // this year
  const yearStart = `${y}-01-01`
  const yearEnd = today

  // last year
  const lastYearStart = `${y - 1}-01-01`
  const lastYearEnd = `${y - 1}-12-31`

  // 6 months ago (for events)
  const sixMonths = new Date(now)
  sixMonths.setMonth(sixMonths.getMonth() - 6)
  const sixMonthsStart = sixMonths.toISOString().slice(0, 10)

  return {
    today,
    last7Start,
    thisMonthStart,
    thisMonthEnd,
    lastMonthStart,
    lastMonthEnd,
    quarterStart,
    quarterEnd,
    yearStart,
    yearEnd,
    lastYearStart,
    lastYearEnd,
    sixMonthsStart,
  }
}

function calcMetricValue(
  items: Array<{ name: string; value: number }>,
  name: string,
  mode: string
): number | null {
  const vals = items.filter((i) => i.name === name).map((i) => i.value)
  if (vals.length === 0) return null
  if (mode === 'avg') return vals.reduce((s, v) => s + v, 0) / vals.length
  if (mode === 'latest') return vals[vals.length - 1]
  return vals.reduce((s, v) => s + v, 0)
}

function fmtNum(v: number | null): string {
  if (v === null) return '-'
  if (Number.isInteger(v)) return String(v)
  return v.toFixed(2)
}

function buildMetricTable(
  pid: number,
  metricDefs: MetricDef[],
  ranges: ReturnType<typeof getDateRanges>,
  lang: Lang
): string {
  if (metricDefs.length === 0)
    return lang === 'zh' ? '暂无指标配置' : 'No metric configured'

  const periods = [
    {
      label: lang === 'zh' ? '最近7天' : 'Last 7d',
      start: ranges.last7Start,
      end: ranges.today,
    },
    {
      label: lang === 'zh' ? '本月' : 'This Month',
      start: ranges.thisMonthStart,
      end: ranges.thisMonthEnd,
    },
    {
      label: lang === 'zh' ? '上月' : 'Last Month',
      start: ranges.lastMonthStart,
      end: ranges.lastMonthEnd,
    },
    {
      label: lang === 'zh' ? '季度' : 'Quarter',
      start: ranges.quarterStart,
      end: ranges.quarterEnd,
    },
    {
      label: lang === 'zh' ? '今年' : 'This Year',
      start: ranges.yearStart,
      end: ranges.yearEnd,
    },
    {
      label: lang === 'zh' ? '去年' : 'Last Year',
      start: ranges.lastYearStart,
      end: ranges.lastYearEnd,
    },
  ]

  // Preload data for each period
  const periodData = periods.map((p) =>
    clawDb.findMetricItems(pid, { startDay: p.start, endDay: p.end })
  )

  const metricLabel = lang === 'zh' ? '指标' : 'Metric'
  const header = `| ${metricLabel} | ${periods.map((p) => p.label).join(' | ')} |`
  const separator = `|${Array(periods.length + 1)
    .fill('---')
    .join('|')}|`

  const rows = metricDefs.map((def) => {
    const mode = def.summary_mode ?? 'sum'
    const modeLabel =
      lang === 'zh'
        ? mode === 'avg'
          ? '(平均)'
          : mode === 'latest'
            ? '(最新)'
            : '(求和)'
        : mode === 'avg'
          ? '(avg)'
          : mode === 'latest'
            ? '(latest)'
            : '(sum)'
    const cols = periodData.map((items) =>
      fmtNum(calcMetricValue(items, def.name, mode))
    )
    return `| ${def.title}${modeLabel} | ${cols.join(' | ')} |`
  })

  return [header, separator, ...rows].join('\n')
}

/**
 * Generate a summary for a project.
 * @param projectId - project ID
 * @param lang - 'en' (default, for LLM prompts) or 'zh' (for UI display)
 */
export function getProjectSummary(
  projectId: number,
  lang: Lang = 'en'
): string {
  const now = new Date()
  const ranges = getDateRanges(now)

  const L =
    lang === 'zh'
      ? {
          project: '项目',
          desc: '描述',
          status: '状态',
          startDate: '开始日期',
          dueDate: '截止日期',
          recentEvents: '近期事件（最近6个月）',
          noEvents: '无事件记录。',
          metricSummary: '指标汇总',
          requirementsSummary: '需求',
          noBacklog: '暂无活跃需求。',
          high: '高',
          medium: '中',
          low: '低',
          priority: '优先级',
          none: '（无）',
          due: '截止',
          statusSummary: '需求状态统计',
          activeDist: '活跃需求分布（非废弃/已完成）',
          top50: '高优先级需求列表（前50条）',
          eventType: '类型',
          eventDate: '日期',
          eventTitle: '标题',
          backlogType: '类型',
          backlogDate: '日期',
          backlogStatus: '状态',
          backlogTitle: '标题',
          statusPending: '待评估',
          statusActive: '已采纳',
          statusPool: '暂缓',
          statusDropped: '废弃',
          statusDone: '已完成',
          total: '合计',
          highPri: '高优',
          medPri: '中优',
          lowPri: '低优',
        }
      : {
          project: 'Project',
          desc: 'Description',
          status: 'Status',
          startDate: 'Start Date',
          dueDate: 'Due Date',
          recentEvents: 'Recent Events (last 6 months)',
          noEvents: 'No events recorded.',
          metricSummary: 'Metric Summary',
          requirementsSummary: 'Requirements',
          noBacklog: 'No active requirements.',
          high: 'High',
          medium: 'Medium',
          low: 'Low',
          priority: 'Priority',
          none: '(none)',
          due: 'due',
          statusSummary: 'Requirement Status Summary',
          activeDist: 'Active requirements distribution (non-dropped/done)',
          top50: 'Top 50 high-priority requirements',
          eventType: 'Type',
          eventDate: 'Date',
          eventTitle: 'Title',
          backlogType: 'Type',
          backlogDate: 'Date',
          backlogStatus: 'Status',
          backlogTitle: 'Title',
          statusPending: 'Pending',
          statusActive: 'Active',
          statusPool: 'Pool',
          statusDropped: 'Dropped',
          statusDone: 'Done',
          total: 'Total',
          highPri: 'High',
          medPri: 'Medium',
          lowPri: 'Low',
        }

  const project = clawDb.findProjectById(projectId)
  if (!project) return ''

  const lines: string[] = []

  // ── Header ──────────────────────────────────────────────────────────────
  lines.push(`**${L.project}:** ${project.title}`)
  lines.push(`**${L.desc}:** ${project.description || L.none}`)
  lines.push(`**${L.status}:** ${project.status}`)
  if (project.start_at) lines.push(`**${L.startDate}:** ${project.start_at}`)
  if (project.due_at) lines.push(`**${L.dueDate}:** ${project.due_at}`)
  lines.push('')

  // ── Metric summary table ────────────────────────────────────────────────
  const metricDefs = clawDb.findMetricByProjectId(projectId)

  if (metricDefs.length > 0) {
    lines.push(`**${L.metricSummary}**`)
    lines.push(buildMetricTable(projectId, metricDefs, ranges, lang))
    lines.push('')
  }

  // ── Recent 6-month events ────────────────────────────────────────────────
  const recentEvents = clawDb
    .findEventsByProjectId(projectId)
    .filter(
      (e) => e.day && e.day >= ranges.sixMonthsStart && e.day <= ranges.today
    )
    .slice(0, 50)

  lines.push(`**${L.recentEvents}**`)
  if (recentEvents.length === 0) {
    lines.push(L.noEvents)
  } else {
    lines.push(`| ${L.eventType} | ${L.eventDate} | ${L.eventTitle} |`)
    lines.push(`|---|---|---|`)
    for (const e of recentEvents) {
      lines.push(`| ${e.type || L.none} | ${e.day || ''} | ${e.title} |`)
    }
  }
  lines.push('')

  // ── Requirements ─────────────────────────────────────────────────────────
  const backlogs = clawDb.findBacklogsByProjectId(projectId, {
    sortBy: 'priority',
  })
  const activeBacklogs = backlogs.filter(
    (b) => b.status !== 'dropped' && b.status !== 'done'
  )

  lines.push(`**${L.requirementsSummary}**`)
  lines.push('')

  // Status counts table
  const statusKeys = ['pending', 'active', 'pool', 'dropped', 'done']
  const statusCounts: Record<string, number> = {}
  for (const b of backlogs) {
    const s = b.status ?? 'unknown'
    statusCounts[s] = (statusCounts[s] ?? 0) + 1
  }
  const statusLabels = [
    L.statusPending,
    L.statusActive,
    L.statusPool,
    L.statusDropped,
    L.statusDone,
  ]
  lines.push(`**${L.statusSummary}**`)
  lines.push(`| ${statusLabels.join(' | ')} | ${L.total} |`)
  lines.push(
    `|${Array(statusKeys.length + 1)
      .fill('---')
      .join('|')}|`
  )
  lines.push(
    `| ${statusKeys.map((s) => String(statusCounts[s] ?? 0)).join(' | ')} | ${backlogs.length} |`
  )
  lines.push('')

  // Distribution of active requirements by priority
  const byPriority: Record<string, typeof activeBacklogs> = {
    high: activeBacklogs.filter((b) => b.priority === 'high'),
    medium: activeBacklogs.filter(
      (b) => b.priority === 'medium' || !b.priority
    ),
    low: activeBacklogs.filter((b) => b.priority === 'low'),
  }

  if (activeBacklogs.length > 0) {
    lines.push(
      `**${L.activeDist}:** ${L.highPri} ${byPriority.high.length} / ${L.medPri} ${byPriority.medium.length} / ${L.lowPri} ${byPriority.low.length} (${L.total} ${activeBacklogs.length})`
    )
    lines.push('')
  }

  // Top 50 requirements
  const statusLabelMap: Record<string, string> =
    lang === 'zh'
      ? {
          pending: '待评估',
          active: '已采纳',
          pool: '暂缓',
          dropped: '废弃',
          done: '已完成',
        }
      : {}
  const getStatusLabel = (s: string) => statusLabelMap[s] ?? s

  if (activeBacklogs.length === 0) {
    lines.push(L.noBacklog)
  } else {
    lines.push(`**${L.top50}:**`)
    lines.push(
      `| ${L.backlogType} | ${L.backlogDate} | ${L.backlogStatus} | ${L.backlogTitle} |`
    )
    lines.push(`|---|---|---|---|`)
    for (const b of activeBacklogs.slice(0, 50)) {
      lines.push(
        `| ${b.type || L.none} | ${b.due_at || ''} | ${getStatusLabel(b.status)} | ${b.title} |`
      )
    }
    lines.push('')
  }

  return lines.join('\n')
}
