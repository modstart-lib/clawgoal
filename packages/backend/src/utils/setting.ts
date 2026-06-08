/**
 * 通用设置工具函数
 * 用于快速读取/写入 setting 表中的配置値
 */
import { settingDb } from '../storage/store/base.js'

/**
 * 获取单个设置值，不存在时返回 defaultValue
 */
export async function getSetting(
  name: string,
  defaultValue: string = ''
): Promise<string> {
  const row = await settingDb.getSetting(name)
  return row?.value ?? defaultValue
}

/**
 * 设置单个值（不存在则创建，存在则更新）
 */
export async function setSetting(name: string, value: string): Promise<void> {
  await settingDb.upsertSetting(name, value)
}

/**
 * 按 names 批量获取指定设置，返回 { name: value } 的键值对对象
 */
export async function getMultiSettings(
  names: string[]
): Promise<Record<string, string>> {
  const rows = await settingDb.getManySettings(names)
  return Object.fromEntries(rows.map((r) => [r.name, r.value]))
}

/**
 * 批量设置多个值
 */
export async function setMultiSettings(
  settings: Record<string, string>
): Promise<void> {
  const entries = Object.entries(settings)
  await Promise.all(
    entries.map(([name, value]) => settingDb.upsertSetting(name, value))
  )
}
