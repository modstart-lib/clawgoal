/**
 * 全局共享 MySQL 连接池
 * 所有 MySQL 存储模块共用同一个连接池实例。
 * 通过环境变量 DATABASE_URL 配置连接，格式：mysql://user:pass@host:port/dbname
 */

import mysql, { Pool } from 'mysql2/promise'
import { createSetting } from './mysql/schema.js'

let _pool: Pool | null = null

/**
 * 获取全局共享的 MySQL 连接池（懒加载，首次调用时创建）。
 * 基础表（setting 等）在创建时统一初始化。
 */
export async function getSharedPool(): Promise<Pool> {
  if (!_pool) {
    const url = process.env.DATABASE_URL ?? ''
    const m = url.match(/^mysql:\/\/([^:]+):([^@]+)@([^:/]+):?(\d*)\/(.+)$/)
    if (!m) throw new Error(`Invalid MySQL DATABASE_URL: ${url}`)
    const [, user, password, host, portStr, database] = m
    _pool = mysql.createPool({
      host,
      port: portStr ? parseInt(portStr) : 3306,
      user,
      password,
      database,
      waitForConnections: true,
      connectionLimit: 10,
      supportBigNumbers: true,
      bigNumberStrings: false,
    })
    await _pool.execute(createSetting())
  }
  return _pool
}

/** 关闭共享连接池（应用退出时调用一次） */
export async function closeSharedPool(): Promise<void> {
  await _pool?.end()
  _pool = null
}
