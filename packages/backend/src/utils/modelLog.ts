import { modelLogDb } from '../storage/store/modelLog.js'
import { wsService } from '../websocket/index.js'
import type {
  InsertModelLogInput,
  ModelDailyStatRow,
  ModelHourlyStatRow,
  ModelLogRow,
  ModelStatRow,
} from '../storage/store/modelLog.js'

export type {
  InsertModelLogInput,
  ModelDailyStatRow,
  ModelHourlyStatRow,
  ModelLogRow,
  ModelStatRow,
}

export function insertModelLog(input: InsertModelLogInput): void {
  modelLogDb.insertModelLog(input)
  try {
    wsService.broadcastSystemEvent('system:modelLog:created', {})
  } catch {
    // ignore if wsService not yet initialized
  }
}

export function listModelLogs(
  tenantId: number,
  userId: number,
  limit?: number,
  offset?: number,
  biz?: string,
  bizId?: string,
  startAt?: string,
  endAt?: string
): ModelLogRow[] {
  return modelLogDb.listModelLogs(
    tenantId,
    userId,
    limit,
    offset,
    biz,
    bizId,
    startAt,
    endAt
  )
}

export function countModelLogs(
  tenantId: number,
  userId: number,
  biz?: string,
  bizId?: string,
  startAt?: string,
  endAt?: string
): number {
  return modelLogDb.countModelLogs(tenantId, userId, biz, bizId, startAt, endAt)
}

export function listModelLogBizValues(
  tenantId: number,
  userId: number
): string[] {
  return modelLogDb.listModelLogBizValues(tenantId, userId)
}

export function aggregateModelStatsByRange(
  tenantId: number,
  userId: number,
  startAt?: string,
  endAt?: string
): ModelStatRow[] {
  return modelLogDb.aggregateModelStatsByRange(tenantId, userId, startAt, endAt)
}

export function modelDailyStats(
  tenantId: number,
  userId: number,
  startAt?: string,
  endAt?: string,
  provider?: string,
  model?: string
): ModelDailyStatRow[] {
  return modelLogDb.modelDailyStats(
    tenantId,
    userId,
    startAt,
    endAt,
    provider,
    model
  )
}

export function modelHourlyStats(
  tenantId: number,
  userId: number,
  startAt?: string,
  endAt?: string,
  provider?: string,
  model?: string
): ModelHourlyStatRow[] {
  return modelLogDb.modelHourlyStats(
    tenantId,
    userId,
    startAt,
    endAt,
    provider,
    model
  )
}
