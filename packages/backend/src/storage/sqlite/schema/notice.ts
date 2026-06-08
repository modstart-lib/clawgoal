/** notice 和 notice_log 表 SQLite DDL */
export function createNotice(): string {
  return `
CREATE TABLE IF NOT EXISTS "notice" (
  "id"                INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
  "tenant_id"           INTEGER NOT NULL DEFAULT 1,
  "user_id"           INTEGER NOT NULL,
  "title"             TEXT    NOT NULL,
  "enable"            INTEGER NOT NULL DEFAULT 1,
  "rate_limit_enable" INTEGER NOT NULL DEFAULT 0,
  "rate_interval"     INTEGER NOT NULL DEFAULT 60,
  "type"              TEXT    NOT NULL,
  "config"            TEXT    NOT NULL DEFAULT '{}',
  "proxy_name"        TEXT,
  "created_at"        TEXT    NOT NULL DEFAULT (datetime('now')),
  "updated_at"        TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS "notice_tenant_id_idx" ON "notice"("tenant_id");
CREATE INDEX IF NOT EXISTS "notice_user_id_idx" ON "notice"("user_id");

CREATE TABLE IF NOT EXISTS "notice_log" (
  "id"         INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
  "tenant_id"    INTEGER NOT NULL DEFAULT 1,
  "user_id"    INTEGER NOT NULL,
  "notice_id"  INTEGER NOT NULL,
  "title"      TEXT    NOT NULL DEFAULT '',
  "content"    TEXT    NOT NULL DEFAULT '',
  "status"     TEXT    NOT NULL DEFAULT 'success',
  "created_at" TEXT    NOT NULL DEFAULT (datetime('now')),
  "updated_at" TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS "notice_log_tenant_id_idx"   ON "notice_log"("tenant_id");
CREATE INDEX IF NOT EXISTS "notice_log_user_id_idx"   ON "notice_log"("user_id");
CREATE INDEX IF NOT EXISTS "notice_log_notice_id_idx" ON "notice_log"("notice_id");
`
}
