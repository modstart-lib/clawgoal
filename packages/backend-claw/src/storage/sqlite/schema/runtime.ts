/** claw_runtime — 远程设备运行环境 */
export function createRuntime(): string {
  return `
-- 兼容迁移：如果旧表还存在，自动重命名
CREATE TABLE IF NOT EXISTS claw_runtime (
  id            INTEGER  PRIMARY KEY AUTOINCREMENT,
  created_at    TEXT     NOT NULL DEFAULT (datetime('now', 'localtime')),
  updated_at    TEXT     NOT NULL DEFAULT (datetime('now', 'localtime')),
  -- 所属用户 ID（SaaS 多租户隔离）
  tenant_id       INTEGER  NOT NULL DEFAULT 1,
  user_id       INTEGER  NOT NULL DEFAULT 1,
  -- 唯一标识（英文），如 "my-laptop"，在同一用户下唯一
  name          TEXT     NOT NULL,
  -- 显示名称，如 "我的笔记本"
  title         TEXT     NOT NULL,
  -- 连接凭证（前端随机生成），runtime 通过 ?token=xxx 连接
  token         TEXT     NOT NULL UNIQUE,
  -- online | offline
  status        TEXT     NOT NULL DEFAULT 'offline',
  -- 最后活跃时间
  active_at     TEXT,
  -- 已发现的本地 Runner 工具列表（JSON 字符串，如 [{name,title},...]）
  runners       TEXT
);

CREATE TRIGGER IF NOT EXISTS claw_runtime_updated_at
AFTER UPDATE ON claw_runtime
BEGIN
  UPDATE claw_runtime SET updated_at = datetime('now', 'localtime') WHERE id = NEW.id;
END;

CREATE UNIQUE INDEX IF NOT EXISTS claw_runtime_user_name_idx ON claw_runtime (user_id, name);
CREATE INDEX IF NOT EXISTS "claw_runtime_tenant_id_idx" ON "claw_runtime"(tenant_id);
CREATE INDEX IF NOT EXISTS claw_runtime_user_id_idx ON claw_runtime (user_id);
`
}
