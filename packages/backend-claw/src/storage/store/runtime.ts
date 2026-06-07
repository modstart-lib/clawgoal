export type RuntimeStatus = 'online' | 'offline'

export interface RuntimeRow {
  id: number
  created_at: string
  updated_at: string
  tenant_id: number
  user_id: number
  /** 唯一英文标识，如 "my-laptop" */
  name: string
  /** 显示名称 */
  title: string
  /** 连接凭证，runtime 通过 ?token=xxx 接入 WebSocket */
  token: string
  /** online | offline */
  status: string
  /** 最后活跃时间 */
  active_at: string | null
  /** 已发现的本地 Runner 工具列表（JSON 字符串，如 [{name,title},...]），null=未同步 */
  runners: string | null
}

export interface RunnerInfo {
  name: string
  title: string
  /** 工具本身的可用状态（如是否已登录授权），由 runtime 客户端上报 */
  status?: string
  /** 是否启用，由用户在界面上控制，runtime 数据同步时不会覆盖此字段 */
  enable?: boolean
}

export interface AddRuntimeInput {
  tenantId: number
  userId: number
  name: string
  title: string
  token: string
}

export interface UpdateRuntimeInput {
  title?: string
  token?: string
  runners?: RunnerInfo[] | null
}
