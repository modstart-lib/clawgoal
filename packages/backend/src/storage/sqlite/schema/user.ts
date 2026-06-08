/** user 表 SQLite DDL */
export function createUser(): string {
  return `
CREATE TABLE IF NOT EXISTS "user" (
  "id"             INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
  "tenant_id"      INTEGER NOT NULL DEFAULT 1,
  "username"       TEXT    NOT NULL,
  "password"       TEXT    NOT NULL,
  "password_salt"  TEXT    NOT NULL,
  "api_data"       TEXT,
  "is_creator"     INTEGER NOT NULL DEFAULT 0,
  "created_at"     TEXT    NOT NULL DEFAULT (datetime('now')),
  "updated_at"     TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE UNIQUE INDEX IF NOT EXISTS "user_username_key" ON "user"("username");
`
}
