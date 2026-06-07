import type { Pool } from 'mysql2/promise'
import { getSharedPool } from '../../mysql.js'
import type { IParamStore, ParamRow } from '../../store/base.js'
import { createParam } from '../schema.js'

export class MysqlParamStore implements IParamStore {
  private pool!: Pool

  async open(): Promise<void> {
    this.pool = await getSharedPool()
    await this.pool.execute(createParam())
  }

  async getParam(
    tenantId: number,
    userId: number,
    name: string
  ): Promise<string | null> {
    const [rows] = (await this.pool.execute(
      'SELECT `value` FROM `user_param` WHERE `tenant_id` = ? AND `user_id` = ? AND `name` = ?',
      [tenantId, userId, name]
    )) as any
    return rows.length ? rows[0].value : null
  }

  async setParam(
    tenantId: number,
    userId: number,
    name: string,
    value: string,
    scope?: string,
    remark?: string
  ): Promise<void> {
    await this.pool.execute(
      'INSERT INTO `user_param` (`tenant_id`, `user_id`, `name`, `value`, `scope`, `remark`) VALUES (?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE `value` = VALUES(`value`), `scope` = VALUES(`scope`), `remark` = VALUES(`remark`), `updated_at` = CURRENT_TIMESTAMP',
      [tenantId, userId, name, value, scope ?? '', remark ?? '']
    )
  }

  async deleteParam(
    tenantId: number,
    userId: number,
    name: string
  ): Promise<void> {
    await this.pool.execute(
      'DELETE FROM `user_param` WHERE `tenant_id` = ? AND `user_id` = ? AND `name` = ?',
      [tenantId, userId, name]
    )
  }

  async findParamByNameAndValue(
    name: string,
    value: string
  ): Promise<{ tenantId: number; userId: number } | null> {
    const [rows] = (await this.pool.execute(
      'SELECT `tenant_id`, `user_id` FROM `user_param` WHERE `name` = ? AND `value` = ? LIMIT 1',
      [name, value]
    )) as any
    if (!rows.length) return null
    return {
      tenantId: Number(rows[0].tenant_id),
      userId: Number(rows[0].user_id),
    }
  }

  async listByPrefix(
    tenantId: number,
    userId: number,
    prefix: string
  ): Promise<ParamRow[]> {
    const rows = await this.query(
      'SELECT `name`, `value`, `scope`, `remark` FROM `user_param` WHERE `tenant_id` = ? AND `user_id` = ? AND `name` LIKE ? ORDER BY `name` ASC',
      [tenantId, userId, `${prefix}%`]
    )
    return rows.map((r: any) => ({
      name: r.name,
      value: r.value ?? '',
      scope: r.scope ?? '',
      remark: r.remark ?? '',
    }))
  }
}
