/**
 * 时区工具函数
 * 所有时间均基于 config.yaml 中 timezone 字段（UTC 偏移小时数）计算，
 * 与系统本地时区解耦，确保在任意宿主环境下行为一致。
 */

import { config } from '../config'

/**
 * 返回 config.timezone 对应的时区标签，如 "UTC+8" / "UTC-5"
 */
export function getTimezoneLabel(): string {
  const tz = config.timezone
  return tz >= 0 ? `UTC+${tz}` : `UTC${tz}`
}

/**
 * 将任意 Date 对象转换为 config.timezone 所指定的本地时间 Date。
 * 返回的 Date 仍是 JS Date，但其 UTC 字段值对应配置时区的本地时间，
 * 请使用 getUTCFullYear() / getUTCHours() 等 UTC 系列方法读取。
 */
export function toConfigLocalTime(date: Date = new Date()): Date {
  const offsetMs = config.timezone * 60 * 60 * 1000
  return new Date(date.getTime() + offsetMs)
}

/**
 * 返回当前时间在 config.timezone 时区下的格式化字符串。
 * 格式：YYYY-MM-DD HH:mm:ss (UTC±N)
 */
export function getLocalTimeStr(date: Date = new Date()): string {
  const local = toConfigLocalTime(date)
  const pad = (n: number) => String(n).padStart(2, '0')
  const dateStr = [
    local.getUTCFullYear(),
    pad(local.getUTCMonth() + 1),
    pad(local.getUTCDate()),
  ].join('-')
  const timeStr = [
    pad(local.getUTCHours()),
    pad(local.getUTCMinutes()),
    pad(local.getUTCSeconds()),
  ].join(':')
  return `${dateStr} ${timeStr} (${getTimezoneLabel()})`
}

/**
 * 返回当前日期在 config.timezone 时区下的字符串，格式 YYYY-MM-DD。
 */
export function today(date: Date = new Date()): string {
  const local = toConfigLocalTime(date)
  const y = local.getUTCFullYear()
  const m = String(local.getUTCMonth() + 1).padStart(2, '0')
  const d = String(local.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/**
 * 简单日期格式化
 * 支持: YYYY MM DD HH mm ss
 */
export function format(date: Date, pattern: string): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return pattern
    .replace('YYYY', String(date.getFullYear()))
    .replace('MM', pad(date.getMonth() + 1))
    .replace('DD', pad(date.getDate()))
    .replace('HH', pad(date.getHours()))
    .replace('mm', pad(date.getMinutes()))
    .replace('ss', pad(date.getSeconds()))
}
