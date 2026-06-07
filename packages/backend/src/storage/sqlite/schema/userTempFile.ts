/** user_temp_file / temp_file 表 SQLite DDL */
export function createUserTempFile(): string {
  return `
CREATE TABLE IF NOT EXISTS "temp_file" (
  "id"          INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
  "tenant_id"   INTEGER NOT NULL DEFAULT 1,
  "user_id"     INTEGER NOT NULL DEFAULT 0,
  "path"        TEXT    NOT NULL,
  "ext"         TEXT    NOT NULL DEFAULT '',
  "local_path"  TEXT    NOT NULL,
  "expire_at"   TEXT    NOT NULL,
  "created_at"  TEXT    NOT NULL DEFAULT (datetime('now')),
  "updated_at"  TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE UNIQUE INDEX IF NOT EXISTS "temp_file_path_key" ON "temp_file"("path");
CREATE INDEX IF NOT EXISTS "temp_file_expire_at_idx" ON "temp_file"("expire_at");
`
}
