export interface AgentMessageAsk {
  id: string
  question: string
  options?: Array<{ label: string; value: string }>
  /** 用户已提交的答案，持久化后刷新界面可恢复已回答状态 */
  answered?: string
}

export interface AgentMessageContent {
  role: 'user' | 'assistant'
  /** 纯文本 / Markdown */
  text?: string
  /** 图片 URL 列表 */
  images?: string[]
  /** 文件 URL 列表 */
  files?: string[]
  /** 阶段状态（节点生命周期、工具调用、工作流、AI思考等） */
  stage?: {
    title: string
    status: 'running' | 'success' | 'error'
    success?: string
    error?: string
  }
  /** 任意元数据（如 toolCallId、workflowId、auditId 等），供 actionView 弹窗使用 */
  meta?: Record<string, any>
  /** 交互式提问选项 */
  asks?: AgentMessageAsk[]
  /** 快捷回复建议按钮 */
  suggests?: Array<{ text: string; icon?: string }>
  /** 操作视图（点击弹窗查看详情），data 为业务参数 */
  actionView?: { label: string; data?: Record<string, any> }
  /** 消息来源渠道，如 telegram / web / cron */
  source?: string
  /** unix 毫秒时间戳字符串 */
  timestamp: string
}

export interface AgentMessageRow {
  id: number
  created_at: string
  updated_at: string
  tenant_id: number
  user_id: number
  agent_id: number
  /** 会话 ID，0 表示无会话（旧消息兼容） */
  session_id: number
  role: string
  /** JSON 序列化的 AgentMessageContent */
  content: string
  /** 0 = 正常，1 = 已被清空消息标记（逻辑删除） */
  is_clear: number
}

export interface InsertAgentMessageInput {
  /** SaaS user id */
  tenantId: number
  userId: number
  agentId: number
  /** 会话 ID，0 表示无会话（cron/task_job 等非交互场景） */
  sessionId: number
  role: 'user' | 'assistant'
  content: AgentMessageContent
}

/**
 * 已解析的消息条目（content 字段已从 JSON 字符串转为对象）。
 * 由存储层在读取时自动完成反序列化，上层无需手动 JSON.parse。
 */
export interface AgentMessageItem {
  id: number
  role: string
  content: AgentMessageContent
  sessionId: number
}
