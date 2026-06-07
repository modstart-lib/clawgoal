import { config } from '../config/index.js'

export interface Tenant {
  id: number
  title: string
}

/**
 * 根据 userId 获取完整的 Tenant 实体。
 * 当前为单租户系统，始终返回 config.yaml 中配置的 supervisorTenantId，
 * title 取 auth.username 作为租户标识。
 */
export function getByUserId(_userId?: number): Tenant {
  return {
    id: config.supervisorTenantId,
    title: config.auth.username,
  }
}
