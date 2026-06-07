export type ChannelType =
  | 'telegram'
  | 'feishu'
  | 'dingtalk'
  | 'wecom'
  | 'discord'
  | 'slack'
  | 'msteams'
  | 'line'
  | 'matrix'
  | 'mattermost'
export type ChannelStatus = 'pending' | 'success'

export interface ChannelConfig {
  token?: string
  chatId?: string
  ownerId?: string
  // 飞书
  appId?: string
  appSecret?: string
  verifyToken?: string
  encryptKey?: string
  // 钉钉
  appKey?: string
  agentId?: string
  robotCode?: string
  userId?: string
  // 企业微信
  corpId?: string
  corpSecret?: string
  toUser?: string
  toParty?: string
  encodingAesKey?: string
  [key: string]: string | undefined
}

export interface ChannelRow {
  id: number
  created_at: string
  updated_at: string
  tenant_id: number
  user_id: number
  title: string
  enable: number
  /** 'telegram' | 'feishu' */
  type: string
  /** JSON 字符串，结构: {token, chatId} */
  config: string | null
  /** 'pending' | 'success' */
  status: string
  /** 是否为默认全局转发渠道（0=否，1=是）。
   * 当某个 Channel 标记为 isGlobal，未配置 channelIds 的 Agent 也会接收此渠道的消息。 */
  is_global: number
}

export interface AddChannelInput {
  tenantId: number
  userId: number
  title: string
  enable?: boolean
  /** 是否为默认全局转发渠道。未配置 channelIds 的 Agent 也会通过此渠道收发消息。 */
  isGlobal?: boolean
  type: ChannelType
  config?: Partial<ChannelConfig>
}
export interface UpdateChannelInput {
  title?: string
  enable?: boolean
  /** 是否为默认全局转发渠道。未配置 channelIds 的 Agent 也会通过此渠道收发消息。 */
  isGlobal?: boolean
  type?: ChannelType
  /** 修改 config 后 status 自动重置为 pending */
  config?: Partial<ChannelConfig>
  status?: ChannelStatus
}
