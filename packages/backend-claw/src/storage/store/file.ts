export interface FileRow {
  id: number
  created_at: string
  updated_at: string
  tenant_id: number
  user_id: number
  /** 文件名（原始名称） */
  title: string
  /** 文件路径，格式：file/<year>/<month>/<day>/<random>.<ext>，实际位置：./data/<path> */
  path: string
  /** 文件后缀（小写，不带点），如 jpg、png、pdf */
  ext: string
  /** 文件大小（字节） */
  size: number
  /** 归属 AI 伙伴 ID，null 表示未绑定 */
  agent_id: number | null
}

export interface AddFileInput {
  /** SaaS user id */
  tenantId: number
  userId: number
  /** 文件名（原始名称） */
  title: string
  /** 文件路径，格式：file/<year>/<month>/<day>/<random>.<ext> */
  path: string
  /** 文件后缀（小写，不带点） */
  ext: string
  /** 文件大小（字节） */
  size: number
  /** 归属 AI 伙伴 ID */
  agentId?: number
}

export interface UpdateFileInput {
  title?: string
  size?: number
  agentId?: number | null
}
