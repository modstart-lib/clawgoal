/** claw_chat_session — 对话会话 */
export function createChatSession(): string {
  return `
CREATE TABLE IF NOT EXISTS claw_chat_session (
  id            INTEGER  PRIMARY KEY AUTOINCREMENT,
  created_at    TEXT     NOT NULL DEFAULT (datetime('now', 'localtime')),
  updated_at    TEXT     NOT NULL DEFAULT (datetime('now', 'localtime')),
  tenant_id     INTEGER  NOT NULL DEFAULT 1,
  user_id       INTEGER  NOT NULL DEFAULT 1,
  agent_id      INTEGER  NOT NULL DEFAULT 0,
  -- 会话标题（首条消息自动截取 / 手动命名）
  title         TEXT     NOT NULL DEFAULT '',
  -- 该会话包含的消息数量（冗余计数，用于展示）
  message_count INTEGER  NOT NULL DEFAULT 0
);

CREATE TRIGGER IF NOT EXISTS claw_chat_session_updated_at
AFTER UPDATE ON claw_chat_session
BEGIN
  UPDATE claw_chat_session SET updated_at = datetime('now', 'localtime') WHERE id = NEW.id;
END;

CREATE INDEX IF NOT EXISTS claw_chat_session_tenant_id_idx  ON claw_chat_session (tenant_id);
CREATE INDEX IF NOT EXISTS claw_chat_session_user_id_idx    ON claw_chat_session (user_id);
CREATE INDEX IF NOT EXISTS claw_chat_session_agent_id_idx   ON claw_chat_session (agent_id);
`
}
