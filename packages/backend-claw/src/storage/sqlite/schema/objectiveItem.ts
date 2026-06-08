/** claw_objective_item — 目标条目 */
export function createObjectiveItem(): string {
  return `
CREATE TABLE IF NOT EXISTS claw_objective_item (
  id            INTEGER  PRIMARY KEY AUTOINCREMENT,
  created_at    TEXT     NOT NULL DEFAULT (datetime('now', 'localtime')),
  updated_at    TEXT     NOT NULL DEFAULT (datetime('now', 'localtime')),
  project_id    INTEGER  NOT NULL,
  title         TEXT     NOT NULL,
  -- pending | done | cancelled
  status        TEXT     NOT NULL DEFAULT 'pending',
  note          TEXT,
  -- 排序序号，越小越靠前
  sort          INTEGER  NOT NULL DEFAULT 0
);

CREATE TRIGGER IF NOT EXISTS claw_objective_item_updated_at
AFTER UPDATE ON claw_objective_item
BEGIN
  UPDATE claw_objective_item SET updated_at = datetime('now', 'localtime') WHERE id = NEW.id;
END;

CREATE INDEX IF NOT EXISTS claw_objective_item_project_id_idx ON claw_objective_item (project_id);
`
}
