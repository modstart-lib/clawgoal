/** claw_project — 项目管理 */
export function createProject(): string {
  return `
CREATE TABLE IF NOT EXISTS claw_project (
  id            INTEGER  PRIMARY KEY AUTOINCREMENT,
  created_at    TEXT     NOT NULL DEFAULT (datetime('now', 'localtime')),
  updated_at    TEXT     NOT NULL DEFAULT (datetime('now', 'localtime')),
  -- 所属用户 ID（SaaS 多租户隔离）
  tenant_id       INTEGER  NOT NULL DEFAULT 1,
  user_id       INTEGER  NOT NULL DEFAULT 1,
  title         TEXT     NOT NULL,
  description   TEXT,
  -- planning | active | paused | done
  status        TEXT     NOT NULL DEFAULT 'planning',
  color         TEXT     NOT NULL DEFAULT '#6366f1',
  logo          TEXT,
  start_at      TEXT,
  due_at        TEXT,
  meta          TEXT
);

CREATE TRIGGER IF NOT EXISTS claw_project_updated_at
AFTER UPDATE ON claw_project
BEGIN
  UPDATE claw_project SET updated_at = datetime('now', 'localtime') WHERE id = NEW.id;
END;

CREATE INDEX IF NOT EXISTS "claw_project_tenant_id_idx" ON "claw_project"(tenant_id);
CREATE INDEX IF NOT EXISTS claw_project_user_id_idx    ON claw_project (user_id);
CREATE INDEX IF NOT EXISTS claw_project_status_idx     ON claw_project (status);
CREATE INDEX IF NOT EXISTS claw_project_created_at_idx ON claw_project (created_at);
`
}
