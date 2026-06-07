/** claw_note — 项目笔记 */
export function createNote(): string {
  return `
CREATE TABLE IF NOT EXISTS claw_note (
  id            INTEGER  PRIMARY KEY AUTOINCREMENT,
  created_at    TEXT     NOT NULL DEFAULT (datetime('now', 'localtime')),
  updated_at    TEXT     NOT NULL DEFAULT (datetime('now', 'localtime')),
  project_id    INTEGER  NOT NULL,
  biz           TEXT,
  type          TEXT,
  title         TEXT     NOT NULL,
  content       TEXT,
  meta          TEXT,
  share_hash    TEXT
);

CREATE TRIGGER IF NOT EXISTS claw_note_updated_at
AFTER UPDATE ON claw_note
BEGIN
  UPDATE claw_note SET updated_at = datetime('now', 'localtime') WHERE id = NEW.id;
END;

CREATE INDEX IF NOT EXISTS claw_note_project_id_idx ON claw_note (project_id);
CREATE INDEX IF NOT EXISTS claw_note_type_idx        ON claw_note (type);
`
}
