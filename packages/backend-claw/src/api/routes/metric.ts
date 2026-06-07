/**
 * Project Metric API routes
 *
 * POST /project-metric/list          — 获取项目的所有指标定义
 * POST /project-metric/add           — 新建指标定义 (body: { projectId, name, title, sort? })
 * POST /project-metric/edit          — 编辑指标定义 (body: { id, title?, sort? })
 * POST /project-metric/delete        — 删除指标定义及其数据 (body: { id })
 * POST /project-metric/item/list     — 获取指标数据（支持按 name / 日期范围筛选）
 * POST /project-metric/item/upsert   — 新增或更新单条指标数据
 * POST /project-metric/item/batch    — 批量 upsert 指标数据 (body: { items: [] })
 * POST /project-metric/item/delete   — 删除指标数据 (body: { projectId, day?, name? })
 * POST /project-metric/item/summary  — 获取指标聚合汇总（按名称 sum/avg/latest）
 */
import { Router } from 'express'
import { ResponseCodes } from '../../../../backend/src/api/types/constants'
import { apiHandler } from '../../../../backend/src/utils/api'
import { error, success } from '../../../../backend/src/utils/response'
import { useI18n } from '../../locale/index.js'
import { clawDb } from '../../storage/store/index.js'
import type { MetricItemRow, MetricRow } from '../../storage/store/types.js'

const router: Router = Router()

// ─── Formatters ───────────────────────────────────────────────────────────────

function formatMetric(row: MetricRow) {
  return {
    id: row.id,
    projectId: row.project_id,
    name: row.name,
    title: row.title,
    sort: row.sort,
    remark: row.remark ?? null,
    summaryMode: row.summary_mode ?? 'sum',
    createdAt: row.created_at,
  }
}

function formatMetricItem(row: MetricItemRow) {
  return {
    id: row.id,
    projectId: row.project_id,
    day: row.day,
    name: row.name,
    value: row.value,
    remark: row.remark ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

// ─── Metric Definition Routes ─────────────────────────────────────────────────

/**
 * @Api /api/claw/metric/list
 * @Summary List metric
 * @BodyParam projectId number Project ID
 * @ReturnDataExample {"records":[{"id":1,"name":"pv","title":"PV访问量","sort":10}]}
 */
router.post(
  '/claw/metric/list',
  apiHandler(async (req, res) => {
    const { projectId } = req.body
    const { t } = useI18n(req)
    if (!projectId)
      return error(res, ResponseCodes.DEFAULT_ERROR, t('projectIdRequired'))

    const records = clawDb.findMetricByProjectId(Number(projectId))
    return success(res, { records: records.map(formatMetric) })
  })
)

/**
 * @Api /api/claw/metric/add
 * @Summary Add metric
 * @BodyParam projectId number Project ID
 * @BodyParam name string Metric key name
 * @BodyParam title string Metric display title
 * @BodyParam sort number? Sort order
 * @BodyParam remark string? Remark
 * @ReturnDataExample {"record":{"id":1,"name":"pv","title":"PV"}}
 */
router.post(
  '/claw/metric/add',
  apiHandler(async (req, res) => {
    const { projectId, name, title, sort, remark, summaryMode } = req.body
    const { t } = useI18n(req)
    if (!projectId)
      return error(res, ResponseCodes.DEFAULT_ERROR, t('projectIdRequired'))
    if (!name?.trim())
      return error(
        res,
        ResponseCodes.DEFAULT_ERROR,
        t('claw.metricNameRequired')
      )
    if (!title?.trim())
      return error(
        res,
        ResponseCodes.DEFAULT_ERROR,
        t('claw.metricTitleRequired')
      )

    const row = clawDb.insertMetric({
      projectId: Number(projectId),
      name: name.trim(),
      title: title.trim(),
      sort: sort !== undefined ? Number(sort) : 0,
      remark: remark?.trim() || undefined,
      summaryMode: summaryMode || 'sum',
    })
    return success(res, { record: formatMetric(row) }, t('claw.metricCreated'))
  })
)

/**
 * @Api /api/claw/metric/edit
 * @Summary Edit metric
 * @BodyParam id number Metric definition ID
 * @BodyParam title string? Updated display title
 * @BodyParam sort number? Updated sort order
 * @BodyParam remark string? Updated remark
 * @ReturnDataExample {"record":{"id":1,"name":"pv","title":"Updated PV"}}
 */
router.post(
  '/claw/metric/edit',
  apiHandler(async (req, res) => {
    const { id, title, sort, remark, summaryMode } = req.body
    const { t } = useI18n(req)
    if (!id) return error(res, ResponseCodes.DEFAULT_ERROR, t('idRequired'))

    const row = clawDb.findMetricById(Number(id))
    if (!row)
      return error(res, ResponseCodes.DEFAULT_ERROR, t('claw.metricNotFound'))

    const updateInput: {
      title?: string
      sort?: number
      remark?: string | null
      summaryMode?: string
    } = {
      title: title?.trim(),
      sort: sort !== undefined ? Number(sort) : undefined,
    }
    if ('remark' in req.body) updateInput.remark = remark?.trim() || null
    if ('summaryMode' in req.body)
      updateInput.summaryMode = summaryMode || 'sum'

    clawDb.updateMetric(Number(id), updateInput)

    const updated = clawDb.findMetricById(Number(id))!
    return success(
      res,
      { record: formatMetric(updated) },
      t('claw.metricUpdated')
    )
  })
)

/**
 * @Api /api/claw/metric/delete
 * @Summary Remove metric
 * @BodyParam id number Metric definition ID
 * @ReturnDataExample {"success":true}
 */
router.post(
  '/claw/metric/delete',
  apiHandler(async (req, res) => {
    const { id } = req.body
    const { t } = useI18n(req)
    if (!id) return error(res, ResponseCodes.DEFAULT_ERROR, t('idRequired'))

    const row = clawDb.findMetricById(Number(id))
    if (!row)
      return error(res, ResponseCodes.DEFAULT_ERROR, t('claw.metricNotFound'))

    // 删除该指标所有数据再删除定义
    clawDb.deleteMetricItems({ projectId: row.project_id, name: row.name })
    clawDb.deleteMetric(Number(id))

    return success(res, null, t('claw.metricDeleted'))
  })
)

// ─── Metric Item Routes ───────────────────────────────────────────────────────

/**
 * @Api /api/claw/metric/item/list
 * @Summary List metric item
 * @BodyParam projectId number Project ID
 * @BodyParam name string? Filter by metric name
 * @BodyParam startDay string? Start date (YYYY-MM-DD)
 * @BodyParam endDay string? End date (YYYY-MM-DD)
 * @ReturnDataExample {"records":[{"id":1,"day":"2024-01-01","name":"pv","value":100}]}
 */
router.post(
  '/claw/metric/item/list',
  apiHandler(async (req, res) => {
    const { projectId, name, startDay, endDay } = req.body
    const { t } = useI18n(req)
    if (!projectId)
      return error(res, ResponseCodes.DEFAULT_ERROR, t('projectIdRequired'))

    const records = clawDb.findMetricItems(Number(projectId), {
      name: name || undefined,
      startDay: startDay || undefined,
      endDay: endDay || undefined,
    })
    return success(res, { records: records.map(formatMetricItem) })
  })
)

/**
 * @Api /api/claw/metric/item/upsert
 * @Summary Upsert metric item
 * @BodyParam projectId number Project ID
 * @BodyParam day string Date (YYYY-MM-DD)
 * @BodyParam name string Metric name
 * @BodyParam value number Metric value
 * @BodyParam remark string? Remark
 * @ReturnDataExample {"record":{"id":1,"day":"2024-01-01","name":"pv","value":100}}
 */
router.post(
  '/claw/metric/item/upsert',
  apiHandler(async (req, res) => {
    const { projectId, day, name, value, remark } = req.body
    const { t } = useI18n(req)
    if (!projectId)
      return error(res, ResponseCodes.DEFAULT_ERROR, t('projectIdRequired'))
    if (!day)
      return error(
        res,
        ResponseCodes.DEFAULT_ERROR,
        t('claw.metricDayRequired')
      )
    if (!name?.trim())
      return error(
        res,
        ResponseCodes.DEFAULT_ERROR,
        t('claw.metricNameRequired')
      )
    if (value === undefined || value === null)
      return error(
        res,
        ResponseCodes.DEFAULT_ERROR,
        t('claw.metricValueRequired')
      )

    const row = clawDb.upsertMetricItem({
      projectId: Number(projectId),
      day,
      name: name.trim(),
      value: Number(value),
      remark: remark?.trim() || null,
    })
    return success(
      res,
      { record: formatMetricItem(row) },
      t('claw.metricItemSaved')
    )
  })
)

/**
 * @Api /api/claw/metric/item/batch
 * @Summary Batch upsert metric item
 * @BodyParam items array Batch items: [{projectId, day, name, value}]
 * @ReturnDataExample {"records":[{"id":1,"day":"2024-01-01","name":"pv","value":100}]}
 */
router.post(
  '/claw/metric/item/batch',
  apiHandler(async (req, res) => {
    const { items } = req.body
    const { t } = useI18n(req)
    if (!Array.isArray(items) || items.length === 0) {
      return error(
        res,
        ResponseCodes.DEFAULT_ERROR,
        t('claw.metricItemsRequired')
      )
    }

    const results: ReturnType<typeof formatMetricItem>[] = []
    for (const item of items) {
      const { projectId, day, name, value } = item
      if (!projectId || !day || !name || value === undefined) continue
      const row = clawDb.upsertMetricItem({
        projectId: Number(projectId),
        day,
        name: name.trim(),
        value: Number(value),
      })
      results.push(formatMetricItem(row))
    }
    return success(res, { records: results }, t('claw.metricBatchSaved'))
  })
)

/**
 * @Api /api/claw/metric/item/delete
 * @Summary Remove metric item
 * @BodyParam projectId number Project ID
 * @BodyParam day string? Filter by date
 * @BodyParam name string? Filter by metric name
 * @ReturnDataExample {"success":true}
 */
router.post(
  '/claw/metric/item/delete',
  apiHandler(async (req, res) => {
    const { projectId, day, name } = req.body
    const { t } = useI18n(req)
    if (!projectId)
      return error(res, ResponseCodes.DEFAULT_ERROR, t('projectIdRequired'))

    clawDb.deleteMetricItems({
      projectId: Number(projectId),
      day: day || undefined,
      name: name || undefined,
    })
    return success(res, null, t('claw.metricItemDeleted'))
  })
)

/**
 * @Api /api/claw/metric/item/summary
 * @Summary Get summary metric item
 * @BodyParam projectId number Project ID
 * @BodyParam startDay string? Start date
 * @BodyParam endDay string? End date
 * @ReturnDataExample {"summary":[{"name":"pv","title":"PV","sum":1000,"avg":100,"latest":120}]}
 */
router.post(
  '/claw/metric/item/summary',
  apiHandler(async (req, res) => {
    const { projectId, startDay, endDay } = req.body
    const { t } = useI18n(req)
    if (!projectId)
      return error(res, ResponseCodes.DEFAULT_ERROR, t('projectIdRequired'))

    const metricList = clawDb.findMetricByProjectId(Number(projectId))
    const items = clawDb.findMetricItems(Number(projectId), {
      startDay: startDay || undefined,
      endDay: endDay || undefined,
    })

    // 按指标名称分组汇总
    const summaryMap: Record<
      string,
      { sum: number; count: number; latest: number; latestDay: string }
    > = {}
    for (const item of items) {
      if (!summaryMap[item.name]) {
        summaryMap[item.name] = { sum: 0, count: 0, latest: 0, latestDay: '' }
      }
      summaryMap[item.name].sum += item.value
      summaryMap[item.name].count += 1
      if (
        !summaryMap[item.name].latestDay ||
        item.day > summaryMap[item.name].latestDay
      ) {
        summaryMap[item.name].latest = item.value
        summaryMap[item.name].latestDay = item.day
      }
    }

    const summary = metricList.map((m) => {
      const stat = summaryMap[m.name] ?? {
        sum: 0,
        count: 0,
        latest: 0,
        latestDay: '',
      }
      return {
        id: m.id,
        name: m.name,
        title: m.title,
        sum: stat.sum,
        avg: stat.count > 0 ? stat.sum / stat.count : 0,
        latest: stat.latest,
        latestDay: stat.latestDay,
        count: stat.count,
      }
    })

    return success(res, { summary })
  })
)

export default router
