/** claw_event — 项目事件 */
export function createEvent(): string {
  return `
CREATE TABLE IF NOT EXISTS claw_event (
  id            INTEGER  PRIMARY KEY AUTOINCREMENT,
  created_at    TEXT     NOT NULL DEFAULT (datetime('now', 'localtime')),
  updated_at    TEXT     NOT NULL DEFAULT (datetime('now', 'localtime')),
  project_id    INTEGER  NOT NULL,
  biz           TEXT,
  title         TEXT     NOT NULL,
  description   TEXT,
  day           TEXT,
  type          TEXT,
  meta          TEXT,
  share_hash    TEXT
);

CREATE TRIGGER IF NOT EXISTS claw_event_updated_at
AFTER UPDATE ON claw_event
BEGIN
  UPDATE claw_event SET updated_at = datetime('now', 'localtime') WHERE id = NEW.id;
END;

CREATE INDEX IF NOT EXISTS claw_event_project_id_idx ON claw_event (project_id);
`
}
