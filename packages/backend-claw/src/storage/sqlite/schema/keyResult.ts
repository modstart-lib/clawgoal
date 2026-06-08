/** claw_key_result — 关键结果（事项） */
export function createKeyResult(): string {
  return `
CREATE TABLE IF NOT EXISTS claw_key_result (
  id                        INTEGER  PRIMARY KEY AUTOINCREMENT,
  created_at                TEXT     NOT NULL DEFAULT (datetime('now', 'localtime')),
  updated_at                TEXT     NOT NULL DEFAULT (datetime('now', 'localtime')),
  tenant_id                 INTEGER  NOT NULL DEFAULT 1,
  user_id                   INTEGER  NOT NULL DEFAULT 1,
  objective_id              INTEGER  NOT NULL,
  title                     TEXT     NOT NULL DEFAULT '',
  detail                    TEXT     NOT NULL DEFAULT '',
  source_project_backlog_id INTEGER,
  -- draft | planned | ready | inProgress | verifying | done
  status                    TEXT     NOT NULL DEFAULT 'draft',
  -- 截止时间
  due_at                    TEXT,
  -- 预计耗时（小时）
  estimated_hours           REAL
);

CREATE TRIGGER IF NOT EXISTS claw_key_result_updated_at
AFTER UPDATE ON claw_key_result
BEGIN
  UPDATE claw_key_result SET updated_at = datetime('now', 'localtime') WHERE id = NEW.id;
END;

CREATE INDEX IF NOT EXISTS claw_key_result_tenant_id_idx    ON claw_key_result (tenant_id);
CREATE INDEX IF NOT EXISTS claw_key_result_user_id_idx      ON claw_key_result (user_id);
CREATE INDEX IF NOT EXISTS claw_key_result_objective_id_idx ON claw_key_result (objective_id);
CREATE INDEX IF NOT EXISTS claw_key_result_status_idx       ON claw_key_result (status);
`
}
