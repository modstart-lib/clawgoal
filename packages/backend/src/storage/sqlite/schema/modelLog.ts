/** model_log — 模型调用流水统计 */
export function createModelLog(): string {
  return `
CREATE TABLE IF NOT EXISTS model_log (
  id                INTEGER  PRIMARY KEY AUTOINCREMENT,
  created_at        TEXT     NOT NULL DEFAULT (datetime('now', 'localtime')),
  updated_at        TEXT     NOT NULL DEFAULT (datetime('now', 'localtime')),
  -- 所属用户 ID（SaaS 多租户隔离）
  tenant_id         INTEGER  NOT NULL DEFAULT 1,
  user_id           INTEGER  NOT NULL DEFAULT 1,
  -- modelProvider 的 name（即配置中 providerName，如 openai / my-deepseek）
  name              TEXT,
  -- provider 名称，如 openai / deepseek
  provider          TEXT,
  -- 完整 model 标识，如 gpt-4o
  model             TEXT     NOT NULL,
  -- 请求消息数
  message_count     INTEGER  NOT NULL DEFAULT 0,
  -- token 统计
  prompt_tokens     INTEGER  NOT NULL DEFAULT 0,
  completion_tokens INTEGER  NOT NULL DEFAULT 0,
  total_tokens      INTEGER  NOT NULL DEFAULT 0,
  -- 耗时（毫秒）
  duration_ms       INTEGER  NOT NULL DEFAULT 0,
  -- success / error
  status            TEXT     NOT NULL DEFAULT 'success',
  -- 错误信息（status=error 时）
  error             TEXT,
  -- 完整请求原始数据（JSON 字符串）
  request_body      TEXT,
  -- 完整返回原始数据（JSON 字符串）
  response_body     TEXT,
  -- 调用业务类型（Chat / Claw）
  biz               TEXT,
  -- 业务标识 ID（如 Chat 的 taskId、Claw 的 chatId）
  biz_id            TEXT
);

CREATE TRIGGER IF NOT EXISTS model_log_updated_at
AFTER UPDATE ON model_log
BEGIN
  UPDATE model_log SET updated_at = datetime('now', 'localtime') WHERE id = NEW.id;
END;

CREATE INDEX IF NOT EXISTS "model_log_tenant_id_idx" ON "model_log"(tenant_id);
CREATE INDEX IF NOT EXISTS model_log_user_id_idx    ON model_log (user_id);
CREATE INDEX IF NOT EXISTS model_log_created_at_idx ON model_log (created_at);
`
}
