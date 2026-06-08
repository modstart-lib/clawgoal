/** claw_objective — 目标 */
export function createObjective(): string {
  return `
CREATE TABLE IF NOT EXISTS claw_objective (
  id            INTEGER  PRIMARY KEY AUTOINCREMENT,
  created_at    TEXT     NOT NULL DEFAULT (datetime('now', 'localtime')),
  updated_at    TEXT     NOT NULL DEFAULT (datetime('now', 'localtime')),
  tenant_id     INTEGER  NOT NULL DEFAULT 1,
  user_id       INTEGER  NOT NULL DEFAULT 1,
  title         TEXT     NOT NULL,
  description   TEXT,
  -- active | completed | failed
  status        TEXT     NOT NULL DEFAULT 'active',
  -- target | rocket | flame
  icon          TEXT     NOT NULL DEFAULT 'target',
  result        TEXT,
  -- 所属项目 ID
  project_id    INTEGER,
  start_at      TEXT,
  end_at        TEXT,
  -- 截止时间
  due_at        TEXT
);

CREATE TRIGGER IF NOT EXISTS claw_objective_updated_at
AFTER UPDATE ON claw_objective
BEGIN
  UPDATE claw_objective SET updated_at = datetime('now', 'localtime') WHERE id = NEW.id;
END;

CREATE INDEX IF NOT EXISTS claw_objective_tenant_id_idx  ON claw_objective (tenant_id);
CREATE INDEX IF NOT EXISTS claw_objective_user_id_idx    ON claw_objective (user_id);
CREATE INDEX IF NOT EXISTS claw_objective_status_idx     ON claw_objective (status);
CREATE INDEX IF NOT EXISTS claw_objective_created_at_idx ON claw_objective (created_at);
CREATE INDEX IF NOT EXISTS claw_objective_project_id_idx  ON claw_objective (project_id);
`
}
