/** claw_objective_project — 目标项目 */
export function createObjectiveProject(): string {
  return `
CREATE TABLE IF NOT EXISTS claw_objective_project (
  id            INTEGER  PRIMARY KEY AUTOINCREMENT,
  created_at    TEXT     NOT NULL DEFAULT (datetime('now', 'localtime')),
  updated_at    TEXT     NOT NULL DEFAULT (datetime('now', 'localtime')),
  -- 所属用户 ID（SaaS 多租户隔离）
  tenant_id       INTEGER  NOT NULL DEFAULT 1,
  user_id       INTEGER  NOT NULL DEFAULT 1,
  title         TEXT     NOT NULL,
  description   TEXT,
  -- active | paused | done
  status        TEXT     NOT NULL DEFAULT 'active',
  -- target | rocket | flame
  icon          TEXT     NOT NULL DEFAULT 'target',
  result        TEXT
);

CREATE TRIGGER IF NOT EXISTS claw_objective_project_updated_at
AFTER UPDATE ON claw_objective_project
BEGIN
  UPDATE claw_objective_project SET updated_at = datetime('now', 'localtime') WHERE id = NEW.id;
END;

CREATE INDEX IF NOT EXISTS "claw_objective_project_tenant_id_idx" ON "claw_objective_project"(tenant_id);
CREATE INDEX IF NOT EXISTS claw_objective_project_user_id_idx    ON claw_objective_project (user_id);
CREATE INDEX IF NOT EXISTS claw_objective_project_status_idx     ON claw_objective_project (status);
CREATE INDEX IF NOT EXISTS claw_objective_project_created_at_idx ON claw_objective_project (created_at);
`
}
