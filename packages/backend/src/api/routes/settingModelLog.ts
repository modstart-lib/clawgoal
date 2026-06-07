import { Router } from 'express'
import {
  aggregateModelStatsByRange,
  countModelLogs,
  listModelLogBizValues,
  listModelLogs,
  modelDailyStats,
  modelHourlyStats,
} from '../../utils/modelLog'
import { apiHandler } from '../../utils/api'
import { success } from '../../utils/response'
import type { AuthRequest } from '../middlewares/auth'
import { supervisorMiddleware } from '../middlewares/auth.js'

const router = Router()

/**
 * @Api /api/setting/model/logs
 * @Summary Get logs setting model
 * @BodyParam page number? Page number (default 1)
 * @BodyParam pageSize number? Page size (default 20)
 * @BodyParam biz string? Filter by biz
 * @BodyParam bizId string? Filter by bizId
 * @BodyParam startAt string? Start date
 * @BodyParam endAt string? End date
 */
router.post(
  '/setting/model/logs',
  supervisorMiddleware,
  apiHandler(async (req, res) => {
    const userId = (req as AuthRequest).user.userId
    const tenantId = (req as AuthRequest).user.tenantId
    const {
      page = 1,
      pageSize = 20,
      biz,
      bizId,
      startAt,
      endAt,
    } = req.body as {
      page?: number
      pageSize?: number
      biz?: string
      bizId?: string
      startAt?: string
      endAt?: string
    }
    const offset = (page - 1) * pageSize
    const rawRecords = listModelLogs(
      tenantId,
      userId,
      pageSize,
      offset,
      biz || undefined,
      bizId || undefined,
      startAt || undefined,
      endAt || undefined
    )
    const total = countModelLogs(
      tenantId,
      userId,
      biz || undefined,
      bizId || undefined,
      startAt || undefined,
      endAt || undefined
    )
    const records = rawRecords.map((r) => ({
      id: r.id,
      createdAt: r.created_at,
      name: r.name,
      provider: r.provider,
      model: r.model,
      biz: r.biz,
      bizId: r.biz_id,
      status: r.status,
      promptTokens: r.prompt_tokens,
      completionTokens: r.completion_tokens,
      totalTokens: r.total_tokens,
      durationMs: r.duration_ms,
      messageCount: r.message_count,
      error: r.error,
      requestBody: r.request_body,
      responseBody: r.response_body,
    }))
    return success(res, { records, page, pageSize, total })
  })
)

/**
 * @Api /api/setting/model/logBizValues
 * @Summary Log Biz Values
 * @ReturnDataExample {"values":["chat","claw"]}
 */
router.post(
  '/setting/model/logBizValues',
  supervisorMiddleware,
  apiHandler(async (req, res) => {
    const userId = (req as AuthRequest).user.userId
    const tenantId = (req as AuthRequest).user.tenantId
    const values = listModelLogBizValues(tenantId, userId)
    return success(res, { values })
  })
)

/**
 * @Api /api/setting/model/stats
 * @Summary Get stats setting model
 * @BodyParam startAt string? Start date
 * @BodyParam endAt string? End date
 * @ReturnDataExample {"records":[{"provider":"openai","model":"gpt-4","call_count":100}]}
 */
router.post(
  '/setting/model/stats',
  supervisorMiddleware,
  apiHandler(async (req, res) => {
    const userId = (req as AuthRequest).user.userId
    const tenantId = (req as AuthRequest).user.tenantId
    const { startAt, endAt } = req.body as { startAt?: string; endAt?: string }
    const rawRecords = aggregateModelStatsByRange(
      tenantId,
      userId,
      startAt,
      endAt
    )
    const records = rawRecords.map((r) => ({
      provider: r.provider,
      model: r.model,
      callCount: r.call_count,
      totalPromptTokens: r.total_prompt_tokens,
      totalCompletionTokens: r.total_completion_tokens,
      totalTokens: r.total_tokens,
      avgDurationMs: r.avg_duration_ms,
      errorCount: r.error_count,
    }))
    return success(res, { records })
  })
)

/**
 * @Api /api/setting/model/dailyStats
 * @Summary Get daily statistics setting model
 * @BodyParam startAt string? Start date
 * @BodyParam endAt string? End date
 * @BodyParam provider string? Filter by provider
 * @BodyParam model string? Filter by model
 * @ReturnDataExample {"records":[{"date":"2024-01-01","provider":"openai","call_count":10}]}
 */
router.post(
  '/setting/model/dailyStats',
  supervisorMiddleware,
  apiHandler(async (req, res) => {
    const userId = (req as AuthRequest).user.userId
    const tenantId = (req as AuthRequest).user.tenantId
    const { startAt, endAt, provider, model } = req.body as {
      startAt?: string
      endAt?: string
      provider?: string
      model?: string
    }
    const rawDailyRecords = modelDailyStats(
      tenantId,
      userId,
      startAt,
      endAt,
      provider,
      model
    )
    const records = rawDailyRecords.map((r) => ({
      date: r.date,
      provider: r.provider,
      model: r.model,
      callCount: r.call_count,
      totalPromptTokens: r.total_prompt_tokens,
      totalCompletionTokens: r.total_completion_tokens,
      totalTokens: r.total_tokens,
    }))
    return success(res, { records })
  })
)

/**
 * @Api /api/setting/model/hourlyStats
 * @Summary Get hourly statistics setting model
 * @BodyParam startAt string? Start date
 * @BodyParam endAt string? End date
 * @BodyParam provider string? Filter by provider
 * @BodyParam model string? Filter by model
 * @ReturnDataExample {"records":[{"hour":"2024-01-01T10:00","provider":"openai","call_count":2}]}
 */
router.post(
  '/setting/model/hourlyStats',
  supervisorMiddleware,
  apiHandler(async (req, res) => {
    const userId = (req as AuthRequest).user.userId
    const tenantId = (req as AuthRequest).user.tenantId
    const { startAt, endAt, provider, model } = req.body as {
      startAt?: string
      endAt?: string
      provider?: string
      model?: string
    }
    const rawHourlyRecords = modelHourlyStats(
      tenantId,
      userId,
      startAt,
      endAt,
      provider,
      model
    )
    const records = rawHourlyRecords.map((r) => ({
      hour: r.hour,
      provider: r.provider,
      model: r.model,
      callCount: r.call_count,
      totalPromptTokens: r.total_prompt_tokens,
      totalCompletionTokens: r.total_completion_tokens,
      totalTokens: r.total_tokens,
    }))
    return success(res, { records })
  })
)

export default router
