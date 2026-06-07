/**
 * ClawGoal 存储层入口
 * 将 claw 内部数据库（Agents、Channels、Crons、Tasks 等）统一暴露到 storage 层。
 *
 * 底层实现：storage/sqlite/store.ts 中的 better-sqlite3 SQLite 实现（已支持全部 Claw 业务）。
 * 若需 MySQL 支持，可在 mysql/claw/ 子目录中扩展并在 storage/index.ts 切换。
 */

// ─── 类型 ─────────────────────────────────────────────────────────────────────

export type { IClawStore } from '../store/store.js'
export type * from '../store/types.js'

// ─── 单例 ─────────────────────────────────────────────────────────────────────

export { clawDb } from '../store/index.js'
