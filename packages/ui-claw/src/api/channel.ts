import apiClient from './client'

export interface ChannelConfig {
  id?: number
  title: string
  type:
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
  enable: boolean
  isGlobal?: boolean
  status?: string
  config: {
    // Telegram
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
    // Discord
    publicKey?: string
    channelId?: string
    guildId?: string
    // Slack
    botToken?: string
    signingSecret?: string
    // MS Teams
    appPassword?: string
    serviceUrl?: string
    conversationId?: string
    // LINE
    channelAccessToken?: string
    channelSecret?: string
    // Matrix
    homeserverUrl?: string
    accessToken?: string
    roomId?: string
    // Mattermost
    serverUrl?: string
    outgoingToken?: string
  }
  createdAt?: string
}

export const getChannelList = async (): Promise<ChannelConfig[]> => {
  const response = await apiClient.post('/claw/channel/list')
  return response.data.data.channels ?? []
}

export const addChannel = async (
  data: Omit<ChannelConfig, 'id' | 'status' | 'createdAt'>
): Promise<number> => {
  const response = await apiClient.post('/claw/channel/add', data)
  return response.data.data.id
}

export const editChannel = async (data: ChannelConfig): Promise<void> => {
  await apiClient.post('/claw/channel/edit', data)
}

export const deleteChannel = async (id: number): Promise<void> => {
  await apiClient.post('/claw/channel/delete', { id })
}

export const toggleChannelEnable = async (
  id: number,
  enable: boolean
): Promise<void> => {
  await apiClient.post('/claw/channel/toggleEnable', { id, enable })
}

export const testChannelSend = async (id: number): Promise<void> => {
  await apiClient.post('/claw/channel/testSend', { id })
}
