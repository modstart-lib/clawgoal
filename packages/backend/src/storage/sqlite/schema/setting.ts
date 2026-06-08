/** setting 表 SQLite DDL */
export function createSetting(): string {
  return `
CREATE TABLE IF NOT EXISTS "setting" (
  "id"         INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
  "name"       TEXT    NOT NULL,
  "value"      TEXT    NOT NULL,
  "created_at" TEXT    NOT NULL DEFAULT (datetime('now')),
  "updated_at" TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE UNIQUE INDEX IF NOT EXISTS "setting_name_key" ON "setting"("name");
`
}
