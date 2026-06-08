import apiClient from './client'

export interface TaskAction {
  id: number
  agentId: number
  status: string
  input: string
  sort: number
}

export interface Task {
  id: number
  title: string
  description: string
  processing: string
  status:
    | 'draft'
    | 'queue'
    | 'pending'
    | 'ready'
    | 'asking'
    | 'running'
    | 'success'
    | 'failed'
    | 'canceled'
  statusText: string
  sessionId: number
  agentId: number | null
  agentTitle: string
  agentAvatar: string | null
  objectiveId?: number | null
  objectiveTitle?: string
  keyResultId?: number | null
  keyResultTitle?: string
  startAt: string
  endAt: string
  dueAt: string
  estimatedHours: number | null
  statusRemark: string
  result: string
  createdAt: string
  updatedAt: string
  source: string
  parentId: number
  rootId: number
  actions: TaskAction[]
  needs: string[]
  projectId?: number | null
  sharedContent: Record<string, unknown>
  /** 接口返回的后代任务列表（扁平，包含直接子任务和更深层级） */
  descendants?: Task[]
}

export interface TaskListParams {
  status?: string
  agentId?: number
  limit?: number
  projectId?: number
}

export const getTasks = async (
  params: TaskListParams = {}
): Promise<Task[]> => {
  const response = await apiClient.post('/claw/task/list', params)
  return response.data.data || []
}

export interface TaskPaginateParams {
  status?: string
  agentId?: number
  keyword?: string
  source?: string
  hasParent?: boolean
  rootOnly?: boolean
  page?: number
  pageSize?: number
  projectId?: number
}

export interface TaskPaginateResult {
  data: Task[]
  page: number
  pageSize: number
  total: number
}

export const paginateTasks = async (
  params: TaskPaginateParams = {}
): Promise<TaskPaginateResult> => {
  const response = await apiClient.post('/claw/task/paginate', params)
  return response.data.data
}

export const getTaskDetail = async (id: number): Promise<Task> => {
  const response = await apiClient.post('/claw/task/detail', { id })
  return response.data.data
}

export const deleteTask = async (id: number): Promise<void> => {
  await apiClient.post('/claw/task/delete', { id })
}

export const stopTask = async (id: number): Promise<void> => {
  await apiClient.post('/claw/task/stop', { id })
}

export const retryTask = async (id: number): Promise<void> => {
  await apiClient.post('/claw/task/retry', { id })
}

export interface EditTaskParams {
  id: number
  title?: string
  description?: string | null
  agentId?: number | null
  dueAt?: string | null
  estimatedHours?: number | null
  source?: string
  needs?: string[]
}

export const editTask = async (params: EditTaskParams): Promise<Task> => {
  const response = await apiClient.post('/claw/task/edit', params)
  return response.data.data
}

export interface AddTaskParams {
  title: string
  description?: string
  agentId?: string
  dueAt?: string
  estimatedHours?: number
  source?: string
  parentId?: number
  needs?: string[]
  projectId?: number
}

export const addTask = async (params: AddTaskParams): Promise<Task> => {
  const response = await apiClient.post('/claw/task/add', params)
  return response.data.data
}

export const getTaskStats = async (params?: {
  projectId?: number
}): Promise<Record<string, number>> => {
  const response = await apiClient.post('/claw/task/stats', params || {})
  return response.data.data.counts
}

export const listChildTasks = async (parentId: number): Promise<Task[]> => {
  const response = await apiClient.post('/claw/task/childList', { parentId })
  return response.data.data || []
}

export interface AddChildTaskParams {
  parentId: number
  title: string
  agentId?: number
  description?: string
}

export const addChildTask = async (
  params: AddChildTaskParams
): Promise<Task> => {
  const response = await apiClient.post('/claw/task/childAdd', params)
  return response.data.data
}

export const deleteChildTask = async (id: number): Promise<void> => {
  await apiClient.post('/claw/task/childDelete', { id })
}

export const getTaskDescendants = async (rootId: number): Promise<Task[]> => {
  const response = await apiClient.post('/claw/task/descendants', { rootId })
  return response.data.data || []
}

export const changeTaskStatus = async (
  id: number,
  status: string,
  statusRemark?: string
): Promise<Task> => {
  const response = await apiClient.post('/claw/task/changeStatus', {
    id,
    status,
    statusRemark,
  })
  return response.data.data
}

export interface AddTaskToKeyResultParams {
  keyResultId: number
  title: string
  description?: string
  agentId?: number
  dueAt?: string
  estimatedHours?: number
}

export const addTaskToKeyResult = async (
  params: AddTaskToKeyResultParams
): Promise<Task> => {
  const response = await apiClient.post('/claw/task/addToKeyResult', params)
  return response.data.data
}

export interface GeneratedTask {
  title: string
  description: string
  agentId: number | null
  dueAt: string
  estimatedHours: number
  needs?: string[]
}

export const generateTask = async (data: {
  keyResultId?: number
  objectiveId?: number
  parentId?: number
  userPrompt?: string
}): Promise<GeneratedTask> => {
  const response = await apiClient.post('/claw/task/generate', data)
  return response.data.data?.task
}

export const batchGenerateTasks = async (data: {
  keyResultId?: number
  objectiveId?: number
  parentId?: number
  userPrompt?: string
}): Promise<GeneratedTask[]> => {
  const response = await apiClient.post('/claw/task/batchGenerate', data)
  return response.data.data?.tasks || []
}

export interface BatchAddTaskItem {
  title: string
  description?: string
  agentId?: number | null
  dueAt?: string
  estimatedHours?: number
  needs?: string[]
}

export const batchAddTasks = async (
  parentId: number,
  tasks: BatchAddTaskItem[]
): Promise<Task[]> => {
  const response = await apiClient.post('/claw/task/batchAdd', {
    parentId,
    tasks,
  })
  return response.data.data?.records || []
}
