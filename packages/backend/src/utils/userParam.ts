import { paramDb } from '../storage/store/userParam.js'

export async function getParam(
  tenantId: number,
  userId: number,
  name: string,
  defaultValue: boolean
): Promise<boolean>
export async function getParam(
  tenantId: number,
  userId: number,
  name: string,
  defaultValue: number
): Promise<number>
export async function getParam(
  tenantId: number,
  userId: number,
  name: string,
  defaultValue?: string
): Promise<string>
export async function getParam(
  tenantId: number,
  userId: number,
  name: string,
  defaultValue: string | boolean | number = ''
): Promise<string | boolean | number> {
  const value = await paramDb.getParam(tenantId, userId, name)
  if (value === undefined || value === null) return defaultValue
  if (typeof defaultValue === 'boolean') return value === 'true'
  if (typeof defaultValue === 'number') return Number(value)
  return value
}

export async function setParam(
  tenantId: number,
  userId: number,
  name: string,
  value: string,
  scope?: string,
  remark?: string
): Promise<void> {
  await paramDb.setParam(tenantId, userId, name, value, scope, remark)
}

export async function deleteParam(
  tenantId: number,
  userId: number,
  name: string
): Promise<void> {
  await paramDb.deleteParam(tenantId, userId, name)
}

export async function findParamByNameAndValue(
  name: string,
  value: string
): Promise<{ tenantId: number; userId: number } | null> {
  return paramDb.findParamByNameAndValue(name, value)
}

export type ParamConfigItem =
  | { name: string; title: string; type: 'text'; defaultValue: string }
  | { name: string; title: string; type: 'switch'; defaultValue: boolean }
  | {
      name: string
      title: string
      type: 'select'
      options: { value: string; title: string }[]
      defaultValue: string
    }
  | {
      name: string
      title: string
      type: 'checkbox'
      options: { value: string; title: string }[]
      defaultValue: string
    }

export interface ParamConfigGroup {
  group: string
  params: ParamConfigItem[]
}
