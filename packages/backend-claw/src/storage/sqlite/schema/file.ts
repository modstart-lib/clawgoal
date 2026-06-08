/** claw_file — 文件管理 */
export function createFile(): string {
  return `
CREATE TABLE IF NOT EXISTS claw_file (
  id            INTEGER  PRIMARY KEY AUTOINCREMENT,
  created_at    TEXT     NOT NULL DEFAULT (datetime('now', 'localtime')),
  updated_at    TEXT     NOT NULL DEFAULT (datetime('now', 'localtime')),
  -- 所属用户 ID（SaaS 多租户隔离）
  tenant_id       INTEGER  NOT NULL DEFAULT 1,
  user_id       INTEGER  NOT NULL DEFAULT 1,
  -- 文件名（原始名称）
  title         TEXT     NOT NULL,
  -- 文件路径，格式：file/<year>/<month>/<day>/<random>.<ext>
  -- 实际存储位置：./data/<path>
  path          TEXT     NOT NULL UNIQUE,
  -- 文件后缀（小写，不带点），如 jpg, png, pdf
  ext           TEXT     NOT NULL DEFAULT '',
  -- 文件大小（字节）
  size          INTEGER  NOT NULL DEFAULT 0,
  -- 归属 AI 伙伴 ID（可选）
  agent_id     INTEGER
);

CREATE TRIGGER IF NOT EXISTS claw_file_updated_at
AFTER UPDATE ON claw_file
BEGIN
  UPDATE claw_file SET updated_at = datetime('now', 'localtime') WHERE id = NEW.id;
END;

CREATE INDEX IF NOT EXISTS "claw_file_tenant_id_idx" ON "claw_file"(tenant_id);
CREATE INDEX IF NOT EXISTS claw_file_user_id_idx    ON claw_file (user_id);
CREATE INDEX IF NOT EXISTS claw_file_agent_id_idx  ON claw_file (agent_id);
CREATE INDEX IF NOT EXISTS claw_file_ext_idx        ON claw_file (ext);
CREATE INDEX IF NOT EXISTS claw_file_created_at_idx ON claw_file (created_at);
`
}
