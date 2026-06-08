/** user_param 表 SQLite DDL */
export function createParam(): string {
  return `
CREATE TABLE IF NOT EXISTS "user_param" (
  "id"         INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
  "tenant_id"  INTEGER NOT NULL DEFAULT 1,
  "user_id"    INTEGER NOT NULL,
  "name"       TEXT    NOT NULL,
  "value"      TEXT    NOT NULL,
  "scope"      TEXT    NOT NULL DEFAULT '',
  "remark"     TEXT    NOT NULL DEFAULT '',
  "created_at" TEXT    NOT NULL DEFAULT (datetime('now')),
  "updated_at" TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE UNIQUE INDEX IF NOT EXISTS "user_param_user_id_name_key" ON "user_param"("tenant_id", "user_id", "name");
CREATE INDEX IF NOT EXISTS "user_param_tenant_id_idx" ON "user_param"("tenant_id");
`
}
