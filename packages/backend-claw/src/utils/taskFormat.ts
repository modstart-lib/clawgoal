/**
 * 任务格式化工具 - 供多个路由复用
 */
import { safeJsonParse } from '../../../backend/src/utils/json.js'
import { clawDb } from '../storage/store/index.js'

export const statusTextMaps: Record<string, Record<string, string>> = {
  'zh-CN': {
    draft: '草稿',
    queue: '队列',
    pending: '等待',
    ready: '就绪',
    asking: '待反馈',
    running: '正在执行',
    success: '成功',
    failed: '失败',
    canceled: '已取消',
  },
  'en-US': {
    draft: 'Draft',
    queue: 'Queue',
    pending: 'Waiting',
    ready: 'Ready',
    asking: 'Awaiting Feedback',
    running: 'Running',
    success: 'Success',
    failed: 'Failed',
    canceled: 'Canceled',
  },
}

export const formatTask = (
  task: any,
  agents: Map<number, { title: string; avatar: string | null }>,
  locale: string = 'zh-CN',
  actions?: Array<{
    id: number
    agentId: number
    status: string
    input: string
    sort: number
  }>
) => ({
  id: task.id,
  title: task.title,
  description: task.description ?? '',
  processing: task.processing ?? '',
  status: task.status,
  statusText:
    (statusTextMaps[locale] ?? statusTextMaps['zh-CN'])[task.status] ??
    task.status,
  agentId: task.agent_id,
  agentTitle: task.agent_id ? (agents.get(task.agent_id)?.title ?? '') : '',
  agentAvatar: task.agent_id
    ? (agents.get(task.agent_id)?.avatar ?? null)
    : null,
  startAt: task.start_at ?? '',
  endAt: task.end_at ?? '',
  dueAt: task.due_at ?? '',
  estimatedHours: task.estimated_hours ?? null,
  statusRemark: task.status_remark ?? '',
  result: task.result ?? '',
  createdAt: task.created_at,
  source: task.source ?? 'manual',
  parentId: task.parent_id ?? 0,
  rootId: task.root_id ?? 0,
  sessionId: task.session_id ?? 0,
  projectId: task.project_id ?? null,
  updatedAt: task.updated_at ?? task.created_at,
  needs: safeJsonParse(task.needs, [], 'taskFormat.needs'),
  sharedContent: safeJsonParse(
    task.shared_content,
    {},
    'taskFormat.sharedContent'
  ),
  actions: actions ?? [],
})

/**
 * 批量获取任务（含所有后代）。
 * 对于根任务（root_id=0），descendants 为其全部后代（root_id = task.id）。
 * 对于子任务，descendants 为其所属根任务树下的全部后代（root_id = task.root_id）。
 */
export const buildTasksWithDescendants = (
  tasks: any[],
  agentMap: Map<number, { title: string; avatar: string | null }>,
  locale: string
) => {
  if (tasks.length === 0) return []
  const rootIds = tasks.map(
    (t: any) => (t.root_id > 0 ? t.root_id : t.id) as number
  )
  const uniqueRootIds = [...new Set(rootIds)]
  const allDescendants = clawDb.findDescendantsByRootIds(uniqueRootIds)
  const descendantsByRoot = new Map<number, any[]>()
  for (const d of allDescendants) {
    if (!descendantsByRoot.has(d.root_id)) descendantsByRoot.set(d.root_id, [])
    descendantsByRoot.get(d.root_id)!.push(d)
  }
  return tasks.map((task: any, i: number) => ({
    ...formatTask(task, agentMap, locale),
    descendants: (descendantsByRoot.get(rootIds[i]) || []).map((d: any) =>
      formatTask(d, agentMap, locale)
    ),
  }))
}
