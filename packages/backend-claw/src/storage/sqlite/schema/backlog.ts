/** claw_backlog — 项目需求池（backlog） */
export function createBacklog(): string {
  return `
CREATE TABLE IF NOT EXISTS claw_backlog (
  id            INTEGER  PRIMARY KEY AUTOINCREMENT,
  created_at    TEXT     NOT NULL DEFAULT (datetime('now', 'localtime')),
  updated_at    TEXT     NOT NULL DEFAULT (datetime('now', 'localtime')),
  project_id    INTEGER  NOT NULL,
  title         TEXT     NOT NULL,
  status        TEXT     NOT NULL DEFAULT 'pending',
  type          TEXT,
  due_at        TEXT,
  source        TEXT,
  reason        TEXT,
  active_at     TEXT,
  done_at       TEXT,
  detail        TEXT,
  priority      TEXT,
  meta          TEXT
);

CREATE TRIGGER IF NOT EXISTS claw_backlog_updated_at
AFTER UPDATE ON claw_backlog
BEGIN
  UPDATE claw_backlog SET updated_at = datetime('now', 'localtime') WHERE id = NEW.id;
END;

CREATE INDEX IF NOT EXISTS claw_backlog_project_id_idx ON claw_backlog (project_id);
CREATE INDEX IF NOT EXISTS claw_backlog_status_idx     ON claw_backlog (status);
`
}
