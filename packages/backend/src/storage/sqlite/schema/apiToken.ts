/** api_token 表 SQLite DDL */
export function createApiToken(): string {
  return `
CREATE TABLE IF NOT EXISTS "api_token" (
  "id"          INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
  "tenant_id"     INTEGER NOT NULL DEFAULT 1,
  "user_id"     INTEGER NOT NULL,
  "token"       TEXT    NOT NULL,
  "permissions" TEXT    NOT NULL DEFAULT '',
  "expire"      TEXT    NOT NULL,
  "title"       TEXT,
  "last_use_time" TEXT,
  "created_at"  TEXT    NOT NULL DEFAULT (datetime('now')),
  "updated_at"  TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE UNIQUE INDEX IF NOT EXISTS "api_token_token_key" ON "api_token"("token");
CREATE INDEX IF NOT EXISTS "api_token_tenant_id_idx" ON "api_token"("tenant_id");
CREATE INDEX IF NOT EXISTS "api_token_user_id_idx" ON "api_token"("user_id");
`
}
