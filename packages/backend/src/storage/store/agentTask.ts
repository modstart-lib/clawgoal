/**
 * AgentTask 公共存储层
 * 包含 AgentTask / AgentTaskFile / AgentTaskMsg / AgentTaskLog 的类型定义、接口与单例。
 */

// ─── 类型定义 ─────────────────────────────────────────────────────────────────

export interface AgentTaskRow {
  id: number
  tenantId: number
  userId: number
  title: string
  initialState: string | null
  checkpoint: string | null
  status: string
  createdAt: Date
  updatedAt: Date
}

export interface CreateAgentTaskInput {
  tenantId: number
  userId: number
  title: string
  initialState?: string | null
  status?: string
}

export interface UpdateAgentTaskInput {
  checkpoint?: string | null
  status?: string
}

// ─── AgentTaskFile ─────────────────────────────────────────────────────────

export interface AgentTaskFileRow {
  id: number
  tenantId: number
  userId: number
  agentTaskId: number
  path: string
  content: string
  createdAt: Date
  updatedAt: Date
}

export interface CreateAgentTaskFileInput {
  tenantId: number
  userId: number
  agentTaskId: number
  path: string
  content: string
}

export interface UpdateAgentTaskFileInput {
  content: string
}

// ─── AgentTaskMsg ──────────────────────────────────────────────────────────

export interface AgentTaskMsgRow {
  id: number
  tenantId: number
  userId: number
  agentTaskId: number
  role: string
  content: string
  createdAt: Date
  updatedAt: Date
}

export interface CreateAgentTaskMsgInput {
  tenantId: number
  userId: number
  agentTaskId: number
  role: string
  content: string
}

// ─── AgentTaskLog ──────────────────────────────────────────────────────────

export interface AgentTaskLogRow {
  id: number
  tenantId: number
  userId: number
  agentTaskId: number
  title: string
  content: string
  createdAt: Date
  updatedAt: Date
}

export interface CreateAgentTaskLogInput {
  tenantId: number
  userId: number
  agentTaskId: number
  title: string
  content: string
}

// ─── 接口 ─────────────────────────────────────────────────────────────────────

export interface IAgentTaskStore {
  // ─── AgentTask ────────────────────────────────────────────────────────

  findAgentTaskById(id: number): Promise<AgentTaskRow | null>
  createAgentTask(data: CreateAgentTaskInput): Promise<AgentTaskRow>
  updateAgentTask(id: number, data: UpdateAgentTaskInput): Promise<void>

  // ─── AgentTaskFile ────────────────────────────────────────────────────

  findAgentTaskFile(
    agentTaskId: number,
    pathStr: string
  ): Promise<AgentTaskFileRow | null>
  createAgentTaskFile(data: CreateAgentTaskFileInput): Promise<AgentTaskFileRow>
  updateAgentTaskFile(id: number, data: UpdateAgentTaskFileInput): Promise<void>

  // ─── AgentTaskMsg ─────────────────────────────────────────────────────

  createAgentTaskMsg(data: CreateAgentTaskMsgInput): Promise<AgentTaskMsgRow>
  updateAgentTaskMsg(id: number, content: string): Promise<void>
  findAgentTaskMsgById(id: number): Promise<AgentTaskMsgRow | null>
  deleteAgentTaskMsg(id: number): Promise<void>
  findAgentTaskMsgs(
    agentTaskId: number,
    options?: { maxId?: number; limit?: number }
  ): Promise<AgentTaskMsgRow[]>

  // ─── AgentTaskLog ─────────────────────────────────────────────────────

  createAgentTaskLog(data: CreateAgentTaskLogInput): Promise<void>
}

// ─── 可注入单例 ───────────────────────────────────────────────────────────────

let _agentTaskStore: IAgentTaskStore | null = null

/** 注入外部存储实现（由 backend-write 等模块在初始化时调用） */
export function setAgentTaskStore(store: IAgentTaskStore): void {
  _agentTaskStore = store
}

function getStore(): IAgentTaskStore {
  if (!_agentTaskStore) {
    throw new Error(
      'AgentTaskStore not initialized. Call setAgentTaskStore() first.'
    )
  }
  return _agentTaskStore
}

/** 全局 agentTask 存储代理（需先调用 setAgentTaskStore 注入实现） */
export const agentTaskDb: IAgentTaskStore = {
  findAgentTaskById(id) {
    return getStore().findAgentTaskById(id)
  },
  createAgentTask(data) {
    return getStore().createAgentTask(data)
  },
  updateAgentTask(id, data) {
    return getStore().updateAgentTask(id, data)
  },
  findAgentTaskFile(agentTaskId, pathStr) {
    return getStore().findAgentTaskFile(agentTaskId, pathStr)
  },
  createAgentTaskFile(data) {
    return getStore().createAgentTaskFile(data)
  },
  updateAgentTaskFile(id, data) {
    return getStore().updateAgentTaskFile(id, data)
  },
  createAgentTaskMsg(data) {
    return getStore().createAgentTaskMsg(data)
  },
  updateAgentTaskMsg(id, content) {
    return getStore().updateAgentTaskMsg(id, content)
  },
  findAgentTaskMsgById(id) {
    return getStore().findAgentTaskMsgById(id)
  },
  deleteAgentTaskMsg(id) {
    return getStore().deleteAgentTaskMsg(id)
  },
  findAgentTaskMsgs(agentTaskId, options) {
    return getStore().findAgentTaskMsgs(agentTaskId, options)
  },
  createAgentTaskLog(data) {
    return getStore().createAgentTaskLog(data)
  },
}
