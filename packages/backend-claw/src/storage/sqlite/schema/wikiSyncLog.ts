/** claw_wiki_sync_log — 项目知识库同步日志 */
export function createWikiSyncLog(): string {
  return `
CREATE TABLE IF NOT EXISTS claw_wiki_sync_log (
  id               INTEGER  PRIMARY KEY AUTOINCREMENT,
  created_at       TEXT     NOT NULL DEFAULT (datetime('now', 'localtime')),
  updated_at       TEXT     NOT NULL DEFAULT (datetime('now', 'localtime')),
  tenant_id       INTEGER  NOT NULL DEFAULT 1,
  user_id          INTEGER  NOT NULL,
  project_id       INTEGER  NOT NULL,
  wiki_id          INTEGER  NOT NULL,
  url              TEXT     NOT NULL,
  -- processing | success | fail
  status           TEXT     NOT NULL DEFAULT 'processing',
  content          TEXT,
  error            TEXT,
  status_remark    TEXT
);

CREATE TRIGGER IF NOT EXISTS claw_wiki_sync_log_updated_at
AFTER UPDATE ON claw_wiki_sync_log
BEGIN
  UPDATE claw_wiki_sync_log SET updated_at = datetime('now', 'localtime') WHERE id = NEW.id;
END;

CREATE INDEX IF NOT EXISTS claw_wiki_sync_log_tenant_id_idx ON claw_wiki_sync_log (tenant_id);
CREATE INDEX IF NOT EXISTS claw_wiki_sync_log_wiki_id_idx ON claw_wiki_sync_log (wiki_id);
CREATE INDEX IF NOT EXISTS claw_wiki_sync_log_project_id_idx ON claw_wiki_sync_log (project_id);
`
}
