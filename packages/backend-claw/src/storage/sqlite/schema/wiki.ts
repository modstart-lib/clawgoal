/** claw_wiki — 项目知识库 */
export function createWiki(): string {
  return `
CREATE TABLE IF NOT EXISTS claw_wiki (
  id            INTEGER  PRIMARY KEY AUTOINCREMENT,
  created_at    TEXT     NOT NULL DEFAULT (datetime('now', 'localtime')),
  updated_at    TEXT     NOT NULL DEFAULT (datetime('now', 'localtime')),
  tenant_id       INTEGER  NOT NULL DEFAULT 1,
  user_id       INTEGER  NOT NULL,
  project_id    INTEGER  NOT NULL,
  biz           TEXT,
  -- processing | success | fail
  status        TEXT     NOT NULL DEFAULT 'success',
  -- manual | syncUrl | syncPath
  type          TEXT     NOT NULL DEFAULT 'manual',
  title         TEXT     NOT NULL DEFAULT '',
  content       TEXT,
  source_url    TEXT,
  -- syncUrl 类型的信息来源 URL
  sync_url      TEXT,
  -- 同步间隔（天），默认 1
  sync_interval INTEGER  NOT NULL DEFAULT 1,
  -- 下次同步时间（syncUrl/syncPath 类型才有意义）
  next_sync_time TEXT,
  -- 同步失败时的错误信息
  status_remark  TEXT,
  -- syncPath 类型的同步目录路径
  sync_path     TEXT,
  meta          TEXT
);

CREATE TRIGGER IF NOT EXISTS claw_wiki_updated_at
AFTER UPDATE ON claw_wiki
BEGIN
  UPDATE claw_wiki SET updated_at = datetime('now', 'localtime') WHERE id = NEW.id;
END;

CREATE INDEX IF NOT EXISTS claw_wiki_project_id_idx ON claw_wiki (project_id);
CREATE INDEX IF NOT EXISTS "claw_wiki_tenant_id_idx" ON "claw_wiki"(tenant_id);
CREATE INDEX IF NOT EXISTS claw_wiki_user_id_idx    ON claw_wiki (user_id);
CREATE INDEX IF NOT EXISTS claw_wiki_status_idx     ON claw_wiki (status);
CREATE INDEX IF NOT EXISTS claw_wiki_type_idx       ON claw_wiki (type);
`
}
