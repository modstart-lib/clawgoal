import { getSharedDb } from '../sqlite.js'
import { SqliteModelLogStore } from '../sqlite/store/modelLog.js'

export interface ModelLogRow {
  id: number
  created_at: string
  updated_at: string
  tenant_id: number
  user_id: number
  /** modelProvider 的 name（配置中的 providerName） */
  name: string | null
  provider: string | null
  model: string
  message_count: number
  prompt_tokens: number
  completion_tokens: number
  total_tokens: number
  duration_ms: number
  /** 'success' | 'error' */
  status: string
  error: string | null
  /** 完整请求原始数据（JSON 字符串） */
  request_body: string | null
  /** 完整返回原始数据（JSON 字符串） */
  response_body: string | null
  /** 调用业务类型（Chat / Claw） */
  biz: string | null
  /** 业务标识 ID */
  biz_id: string | null
}

export interface InsertModelLogInput {
  tenantId: number
  userId: number
  /** modelProvider 的 name（配置中的 providerName） */
  name?: string
  provider?: string
  model: string
  messageCount?: number
  promptTokens?: number
  completionTokens?: number
  totalTokens?: number
  durationMs: number
  status: 'success' | 'error'
  error?: string
  /** 完整请求原始数据，会序列化为 JSON 字符串存储 */
  requestBody?: unknown
  /** 完整返回原始数据，会序列化为 JSON 字符串存储 */
  responseBody?: unknown
  /** 调用业务类型（Chat / Claw） */
  biz?: string
  /** 业务标识 ID（如 Chat 的 taskId、Claw 的 chatId） */
  bizId?: string
}

export interface ModelStatRow {
  provider: string | null
  model: string
  call_count: number
  total_prompt_tokens: number
  total_completion_tokens: number
  total_tokens: number
  avg_duration_ms: number
  error_count: number
}

export interface ModelDailyStatRow {
  date: string
  provider: string | null
  model: string
  call_count: number
  total_prompt_tokens: number
  total_completion_tokens: number
  total_tokens: number
}

export interface ModelHourlyStatRow {
  hour: string
  provider: string | null
  model: string
  call_count: number
  total_prompt_tokens: number
  total_completion_tokens: number
  total_tokens: number
}

export interface IModelLogStore {
  insertModelLog(input: InsertModelLogInput): void
  listModelLogs(
    tenantId: number,
    userId: number,
    limit?: number,
    offset?: number,
    biz?: string,
    bizId?: string,
    startAt?: string,
    endAt?: string
  ): ModelLogRow[]
  countModelLogs(
    tenantId: number,
    userId: number,
    biz?: string,
    bizId?: string,
    startAt?: string,
    endAt?: string
  ): number
  listModelLogBizValues(tenantId: number, userId: number): string[]
  aggregateModelStats(tenantId: number, userId: number): ModelStatRow[]
  aggregateModelStatsByRange(
    tenantId: number,
    userId: number,
    startAt?: string,
    endAt?: string
  ): ModelStatRow[]
  modelDailyStats(
    tenantId: number,
    userId: number,
    startAt?: string,
    endAt?: string,
    provider?: string,
    model?: string
  ): ModelDailyStatRow[]
  modelHourlyStats(
    tenantId: number,
    userId: number,
    startAt?: string,
    endAt?: string,
    provider?: string,
    model?: string
  ): ModelHourlyStatRow[]
}

let _store: SqliteModelLogStore | null = null

export const modelLogDb: IModelLogStore & { open(): void } = {
  open() {
    const inst = new SqliteModelLogStore(getSharedDb())
    _store = inst
  },
  insertModelLog(input) {
    return _store!.insertModelLog(input)
  },
  listModelLogs(tenantId, userId, limit, offset, biz, bizId, startAt, endAt) {
    return _store!.listModelLogs(
      tenantId,
      userId,
      limit,
      offset,
      biz,
      bizId,
      startAt,
      endAt
    )
  },
  countModelLogs(tenantId, userId, biz, bizId, startAt, endAt) {
    return _store!.countModelLogs(tenantId, userId, biz, bizId, startAt, endAt)
  },
  listModelLogBizValues(tenantId, userId) {
    return _store!.listModelLogBizValues(tenantId, userId)
  },
  aggregateModelStats(tenantId, userId) {
    return _store!.aggregateModelStats(tenantId, userId)
  },
  aggregateModelStatsByRange(tenantId, userId, startAt, endAt) {
    return _store!.aggregateModelStatsByRange(tenantId, userId, startAt, endAt)
  },
  modelDailyStats(tenantId, userId, startAt, endAt, provider, model) {
    return _store!.modelDailyStats(
      tenantId,
      userId,
      startAt,
      endAt,
      provider,
      model
    )
  },
  modelHourlyStats(tenantId, userId, startAt, endAt, provider, model) {
    return _store!.modelHourlyStats(
      tenantId,
      userId,
      startAt,
      endAt,
      provider,
      model
    )
  },
}
