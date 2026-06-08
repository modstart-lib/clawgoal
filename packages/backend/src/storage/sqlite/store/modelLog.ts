import type { Database } from 'bun:sqlite'
import { execSqlSafe } from '../migrate.js'
import { makeSqlHelper } from '../../sqlite.js'
import type {
  InsertModelLogInput,
  IModelLogStore,
  ModelDailyStatRow,
  ModelHourlyStatRow,
  ModelLogRow,
  ModelStatRow,
} from '../../store/modelLog.js'
import { createModelLog } from '../schema/modelLog.js'

export class SqliteModelLogStore implements IModelLogStore {
  private sql: ReturnType<typeof makeSqlHelper>

  constructor(db: Database) {
    execSqlSafe(db, createModelLog())
    this.sql = makeSqlHelper(db, (q) => q)
  }

  insertModelLog(input: InsertModelLogInput): void {
    this.sql(
      `
      INSERT INTO model_log
        (created_at, updated_at, tenant_id, user_id, name, provider, model, message_count, prompt_tokens, completion_tokens, total_tokens, duration_ms, status, error, request_body, response_body, biz, biz_id)
      VALUES
        (datetime('now', 'localtime'), datetime('now', 'localtime'), $tenantId, $userId, $name, $provider, $model, $messageCount, $promptTokens, $completionTokens, $totalTokens, $durationMs, $status, $error, $requestBody, $responseBody, $biz, $bizId)
    `
    ).run({
      tenantId: input.tenantId,
      userId: input.userId,
      name: input.name ?? null,
      provider: input.provider ?? null,
      model: input.model,
      messageCount: input.messageCount ?? 0,
      promptTokens: input.promptTokens ?? 0,
      completionTokens: input.completionTokens ?? 0,
      totalTokens: input.totalTokens ?? 0,
      durationMs: input.durationMs,
      status: input.status,
      error: input.error ?? null,
      requestBody:
        input.requestBody != null ? JSON.stringify(input.requestBody) : null,
      responseBody:
        input.responseBody != null ? JSON.stringify(input.responseBody) : null,
      biz: input.biz ?? null,
      bizId: input.bizId ?? null,
    })
  }

  listModelLogs(
    tenantId: number,
    userId: number,
    limit = 20,
    offset = 0,
    biz?: string,
    bizId?: string,
    startAt?: string,
    endAt?: string
  ): ModelLogRow[] {
    const conditions: string[] = ['tenant_id = $tenantId', 'user_id = $userId']
    const params: Record<string, string | number> = {
      tenantId,
      userId,
      limit,
      offset,
    }
    if (biz) {
      conditions.push('biz = $biz')
      params.biz = biz
    }
    if (bizId) {
      conditions.push('biz_id = $bizId')
      params.bizId = bizId
    }
    if (startAt) {
      conditions.push('created_at >= $startAt')
      params.startAt = startAt
    }
    if (endAt) {
      conditions.push('created_at <= $endAt')
      params.endAt = endAt
    }
    const where = `WHERE ${conditions.join(' AND ')}`
    return this.sql(
      `SELECT * FROM model_log ${where} ORDER BY id DESC LIMIT $limit OFFSET $offset`
    ).all(params) as ModelLogRow[]
  }

  countModelLogs(
    tenantId: number,
    userId: number,
    biz?: string,
    bizId?: string,
    startAt?: string,
    endAt?: string
  ): number {
    const conditions: string[] = ['tenant_id = $tenantId', 'user_id = $userId']
    const params: Record<string, string | number> = { tenantId, userId }
    if (biz) {
      conditions.push('biz = $biz')
      params.biz = biz
    }
    if (bizId) {
      conditions.push('biz_id = $bizId')
      params.bizId = bizId
    }
    if (startAt) {
      conditions.push('created_at >= $startAt')
      params.startAt = startAt
    }
    if (endAt) {
      conditions.push('created_at <= $endAt')
      params.endAt = endAt
    }
    const where = `WHERE ${conditions.join(' AND ')}`
    const row = this.sql(`SELECT COUNT(*) AS cnt FROM model_log ${where}`).get(
      params
    ) as { cnt: number }
    return row?.cnt ?? 0
  }

  listModelLogBizValues(tenantId: number, userId: number): string[] {
    const rows = this.sql(
      'SELECT DISTINCT biz FROM model_log WHERE tenant_id = ? AND user_id = ? AND biz IS NOT NULL ORDER BY biz ASC'
    ).all(tenantId, userId) as { biz: string }[]
    return rows.map((r) => r.biz)
  }

  aggregateModelStats(tenantId: number, userId: number): ModelStatRow[] {
    return this.sql(
      `
      SELECT
        provider,
        model,
        COUNT(*)                          AS call_count,
        SUM(prompt_tokens)                AS total_prompt_tokens,
        SUM(completion_tokens)            AS total_completion_tokens,
        SUM(total_tokens)                 AS total_tokens,
        CAST(AVG(duration_ms) AS INTEGER) AS avg_duration_ms,
        SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END) AS error_count
      FROM model_log
      WHERE tenant_id = ? AND user_id = ?
      GROUP BY provider, model
      ORDER BY call_count DESC
    `
    ).all(tenantId, userId) as ModelStatRow[]
  }

  aggregateModelStatsByRange(
    tenantId: number,
    userId: number,
    startAt?: string,
    endAt?: string
  ): ModelStatRow[] {
    const conditions: string[] = ['tenant_id = $tenantId', 'user_id = $userId']
    const params: Record<string, string | number> = { tenantId, userId }
    if (startAt) {
      conditions.push('created_at >= $startAt')
      params.startAt = startAt
    }
    if (endAt) {
      conditions.push('created_at <= $endAt')
      params.endAt = endAt
    }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
    return this.sql(
      `
      SELECT
        provider,
        model,
        COUNT(*)                          AS call_count,
        SUM(prompt_tokens)                AS total_prompt_tokens,
        SUM(completion_tokens)            AS total_completion_tokens,
        SUM(total_tokens)                 AS total_tokens,
        CAST(AVG(duration_ms) AS INTEGER) AS avg_duration_ms,
        SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END) AS error_count
      FROM model_log
      ${where}
      GROUP BY provider, model
      ORDER BY call_count DESC
    `
    ).all(params) as ModelStatRow[]
  }

  modelDailyStats(
    tenantId: number,
    userId: number,
    startAt?: string,
    endAt?: string,
    provider?: string,
    model?: string
  ): ModelDailyStatRow[] {
    const conditions: string[] = ['tenant_id = $tenantId', 'user_id = $userId']
    const params: Record<string, string | number> = { tenantId, userId }
    if (startAt) {
      conditions.push('created_at >= $startAt')
      params.startAt = startAt
    }
    if (endAt) {
      conditions.push('created_at <= $endAt')
      params.endAt = endAt
    }
    if (provider) {
      conditions.push('provider = $provider')
      params.provider = provider
    }
    if (model) {
      conditions.push('model = $model')
      params.model = model
    }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
    return this.sql(
      `
      SELECT
        DATE(datetime(created_at, 'localtime')) AS date,
        provider,
        model,
        COUNT(*)               AS call_count,
        SUM(prompt_tokens)     AS total_prompt_tokens,
        SUM(completion_tokens) AS total_completion_tokens,
        SUM(total_tokens)      AS total_tokens
      FROM model_log
      ${where}
      GROUP BY DATE(datetime(created_at, 'localtime')), provider, model
      ORDER BY date ASC
    `
    ).all(params) as ModelDailyStatRow[]
  }

  modelHourlyStats(
    tenantId: number,
    userId: number,
    startAt?: string,
    endAt?: string,
    provider?: string,
    model?: string
  ): ModelHourlyStatRow[] {
    const conditions: string[] = ['tenant_id = $tenantId', 'user_id = $userId']
    const params: Record<string, string | number> = { tenantId, userId }
    if (startAt) {
      conditions.push('created_at >= $startAt')
      params.startAt = startAt
    }
    if (endAt) {
      conditions.push('created_at <= $endAt')
      params.endAt = endAt
    }
    if (provider) {
      conditions.push('provider = $provider')
      params.provider = provider
    }
    if (model) {
      conditions.push('model = $model')
      params.model = model
    }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
    return this.sql(
      `
      SELECT
        STRFTIME('%Y-%m-%d %H:00', created_at) AS hour,
        provider,
        model,
        COUNT(*)               AS call_count,
        SUM(prompt_tokens)     AS total_prompt_tokens,
        SUM(completion_tokens) AS total_completion_tokens,
        SUM(total_tokens)      AS total_tokens
      FROM model_log
      ${where}
      GROUP BY STRFTIME('%Y-%m-%d %H:00', created_at), provider, model
      ORDER BY hour ASC
    `
    ).all(params) as ModelHourlyStatRow[]
  }
}
