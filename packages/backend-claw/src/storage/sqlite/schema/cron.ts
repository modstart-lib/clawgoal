/** claw_cron — 定时任务配置 */
export function createCron(): string {
  return `
CREATE TABLE IF NOT EXISTS claw_cron (
  id                  INTEGER  PRIMARY KEY AUTOINCREMENT,
  created_at          TEXT     NOT NULL DEFAULT (datetime('now', 'localtime')),
  updated_at          TEXT     NOT NULL DEFAULT (datetime('now', 'localtime')),
  -- 所属用户 ID（SaaS 多租户隔离）
  tenant_id       INTEGER  NOT NULL DEFAULT 1,
  user_id             INTEGER  NOT NULL DEFAULT 1,
  title               TEXT     NOT NULL,
  -- cron 表达式，如 "0 8 * * *"
  cron                TEXT     NOT NULL,
  enable              INTEGER  NOT NULL DEFAULT 1,
  -- 关联的 Agent（必填）
  agent_id           INTEGER  NOT NULL,
  -- 任务说明
  description         TEXT,
  -- 执行时发送给 agent 的 prompt
  prompt              TEXT     NOT NULL DEFAULT '',
  -- 上次执行时间
  last_run_at         TEXT,
  -- 下次执行时间（由调度器维护，用于判断是否应该执行）
  next_run_at         TEXT,
  -- 上次执行状态：success | error
  last_status         TEXT,
  -- 上次执行状态备注（错误信息等）
  last_status_remark  TEXT,
  -- 上次执行结果摘要
  last_result         TEXT,
  -- 执行一次后自动禁用（1=是，0=否）
  run_once            INTEGER  NOT NULL DEFAULT 0,
  -- 是否需要运行（1=需要，0=不需要；一次性任务执行后置为 0 防止重复执行）
  should_run          INTEGER  NOT NULL DEFAULT 1,
  -- 扩展配置（JSON 字符串）
  config              TEXT,
  -- 成功时是否发送消息通知（1=是，0=否）
  success_notify      INTEGER  NOT NULL DEFAULT 0
);

CREATE TRIGGER IF NOT EXISTS claw_cron_updated_at
AFTER UPDATE ON claw_cron
BEGIN
  UPDATE claw_cron SET updated_at = datetime('now', 'localtime') WHERE id = NEW.id;
END;

CREATE INDEX IF NOT EXISTS "claw_cron_tenant_id_idx" ON "claw_cron"(tenant_id);
CREATE INDEX IF NOT EXISTS claw_cron_user_id_idx ON claw_cron (user_id);
`
}
