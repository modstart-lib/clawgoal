/**
 * SQLite 基础表 DDL
 */

/** 生成 setting 建表语句（幂等） */
export function buildSettingDdl(): string {
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

/** 生成 param 建表语句（幂等，旧版兼容，已废弃，表已重命名为 user_param） */
export function buildParamDdl(): string {
  return `
CREATE TABLE IF NOT EXISTS "param" (
  "id"         INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
  "user_id"    INTEGER NOT NULL,
  "name"       TEXT    NOT NULL,
  "value"      TEXT    NOT NULL,
  "created_at" TEXT    NOT NULL DEFAULT (datetime('now')),
  "updated_at" TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE UNIQUE INDEX IF NOT EXISTS "param_user_id_name_key" ON "param"("user_id", "name");
`
}

/** 生成 env 建表语句（幂等） */
export function buildEnvDdl(): string {
  return `
CREATE TABLE IF NOT EXISTS "env" (
  id         INTEGER  PRIMARY KEY AUTOINCREMENT,
  created_at TEXT     NOT NULL DEFAULT (datetime('now', 'localtime')),
  updated_at TEXT     NOT NULL DEFAULT (datetime('now', 'localtime')),
  user_id    INTEGER  NOT NULL DEFAULT 1,
  name       TEXT     NOT NULL,
  value      TEXT     NOT NULL DEFAULT ''
);
CREATE TRIGGER IF NOT EXISTS "env_updated_at"
AFTER UPDATE ON "env"
BEGIN
  UPDATE "env" SET updated_at = datetime('now', 'localtime') WHERE id = NEW.id;
END;
CREATE UNIQUE INDEX IF NOT EXISTS "env_user_name_idx" ON "env" (user_id, name);
CREATE INDEX IF NOT EXISTS "env_user_id_idx" ON "env" (user_id);
CREATE INDEX IF NOT EXISTS "env_name_idx" ON "env" (name);
`
}

/** 生成 api_token 建表语句（幂等） */
export function buildApiTokenDdl(): string {
  return `
CREATE TABLE IF NOT EXISTS "api_token" (
  "id"          INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
  "user_id"     INTEGER NOT NULL,
  "token"       TEXT    NOT NULL,
  "permissions" TEXT    NOT NULL DEFAULT '',
  "expire"      TEXT    NOT NULL,
  "title"       TEXT,
  "created_at"  TEXT    NOT NULL DEFAULT (datetime('now')),
  "updated_at"  TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE UNIQUE INDEX IF NOT EXISTS "api_token_token_key" ON "api_token"("token");
CREATE INDEX IF NOT EXISTS "api_token_user_id_idx" ON "api_token"("user_id");
`
}

/** 生成 agent_task* 建表语句（幂等） */
export function buildAgentTaskDdl(): string {
  return `
CREATE TABLE IF NOT EXISTS "agent_task" (
  "id"            INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
  "user_id"       INTEGER NOT NULL,
  "title"         TEXT    NOT NULL,
  "biz"           TEXT    NOT NULL,
  "biz_id"        INTEGER NOT NULL,
  "initial_state" TEXT,
  "checkpoint"    TEXT,
  "status"        TEXT    NOT NULL DEFAULT 'pending',
  "created_at"    TEXT    NOT NULL DEFAULT (datetime('now')),
  "updated_at"    TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS "agent_task_user_id_idx" ON "agent_task"("user_id");
CREATE UNIQUE INDEX IF NOT EXISTS "agent_task_biz_biz_id_key" ON "agent_task"("biz","biz_id");

CREATE TABLE IF NOT EXISTS "agent_task_file" (
  "id"            INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
  "user_id"       INTEGER NOT NULL,
  "agent_task_id" INTEGER NOT NULL,
  "path"          TEXT    NOT NULL,
  "content"       TEXT    NOT NULL DEFAULT '',
  "created_at"    TEXT    NOT NULL DEFAULT (datetime('now')),
  "updated_at"    TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS "agent_task_file_user_id_idx" ON "agent_task_file"("user_id");
CREATE INDEX IF NOT EXISTS "agent_task_file_task_id_idx" ON "agent_task_file"("agent_task_id");

CREATE TABLE IF NOT EXISTS "agent_task_msg" (
  "id"            INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
  "user_id"       INTEGER NOT NULL,
  "agent_task_id" INTEGER NOT NULL,
  "role"          TEXT    NOT NULL,
  "content"       TEXT    NOT NULL DEFAULT '',
  "created_at"    TEXT    NOT NULL DEFAULT (datetime('now')),
  "updated_at"    TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS "agent_task_msg_user_id_idx" ON "agent_task_msg"("user_id");
CREATE INDEX IF NOT EXISTS "agent_task_msg_task_id_idx" ON "agent_task_msg"("agent_task_id","id");

CREATE TABLE IF NOT EXISTS "agent_task_log" (
  "id"            INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
  "user_id"       INTEGER NOT NULL,
  "agent_task_id" INTEGER NOT NULL,
  "title"         TEXT    NOT NULL,
  "content"       TEXT    NOT NULL DEFAULT '',
  "created_at"    TEXT    NOT NULL DEFAULT (datetime('now')),
  "updated_at"    TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS "agent_task_log_user_id_idx" ON "agent_task_log"("user_id");
CREATE INDEX IF NOT EXISTS "agent_task_log_task_id_idx" ON "agent_task_log"("agent_task_id");
`
}
