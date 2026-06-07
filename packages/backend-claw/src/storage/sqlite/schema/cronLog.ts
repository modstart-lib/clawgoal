/** claw_cron_log — 定时任务执行日志 */
export function createCronLog(): string {
  return `
CREATE TABLE IF NOT EXISTS claw_cron_log (
  id              INTEGER  PRIMARY KEY AUTOINCREMENT,
  created_at      TEXT     NOT NULL DEFAULT (datetime('now', 'localtime')),
  updated_at      TEXT     NOT NULL DEFAULT (datetime('now', 'localtime')),
  -- 所属用户 ID（SaaS 多租户隔离）
  tenant_id       INTEGER  NOT NULL DEFAULT 1,
  user_id         INTEGER  NOT NULL DEFAULT 1,
  -- 关联的 Agent（可选）
  agent_id       INTEGER,
  -- 关联的定时任务
  cron_id         INTEGER  NOT NULL,
  title           TEXT     NOT NULL,
  -- 任务开始时间
  start_at        TEXT     NOT NULL,
  -- 任务结束时间
  end_at          TEXT,
  -- success | error
  status          TEXT     NOT NULL DEFAULT 'success',
  -- 状态备注（错误信息等）
  status_remark   TEXT,
  -- 执行结果摘要
  result          TEXT,
  -- 完整文本日志
  logs            TEXT
);

CREATE TRIGGER IF NOT EXISTS claw_cron_log_updated_at
AFTER UPDATE ON claw_cron_log
BEGIN
  UPDATE claw_cron_log SET updated_at = datetime('now', 'localtime') WHERE id = NEW.id;
END;

CREATE INDEX IF NOT EXISTS "claw_cron_log_tenant_id_idx" ON "claw_cron_log"(tenant_id);
CREATE INDEX IF NOT EXISTS claw_cron_log_user_id_idx    ON claw_cron_log (user_id);
CREATE INDEX IF NOT EXISTS claw_cron_log_cron_id_idx    ON claw_cron_log (cron_id);
CREATE INDEX IF NOT EXISTS claw_cron_log_start_at_idx   ON claw_cron_log (start_at);
CREATE INDEX IF NOT EXISTS claw_cron_log_agent_id_idx  ON claw_cron_log (agent_id);
`
}
