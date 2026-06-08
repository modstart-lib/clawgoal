/** claw_agent_session — 对话会话 */
export function createAgentSession(): string {
  return `
CREATE TABLE IF NOT EXISTS claw_agent_session (
  id            INTEGER  PRIMARY KEY AUTOINCREMENT,
  created_at    TEXT     NOT NULL DEFAULT (datetime('now', 'localtime')),
  updated_at    TEXT     NOT NULL DEFAULT (datetime('now', 'localtime')),
  tenant_id     INTEGER  NOT NULL DEFAULT 1,
  user_id       INTEGER  NOT NULL DEFAULT 1,
  agent_id      INTEGER  NOT NULL DEFAULT 0,
  -- 会话标题（首条消息自动截取 / 手动命名）
  title         TEXT     NOT NULL DEFAULT '',
  -- 该会话包含的消息数量（冗余计数，用于展示）
  message_count INTEGER  NOT NULL DEFAULT 0,
  -- 会话扩展数据（JSON 对象，含 workflow 状态等）
  data          TEXT     NOT NULL DEFAULT '{}',
  -- asks 工具暂停时保存的 agentic loop 状态（JSON，null 表示无暂停状态）
  agentic_data  TEXT,
  -- 近期对话历史消息（序列化的 BaseMessage 数组，null 表示无历史）
  history       TEXT
);

CREATE TRIGGER IF NOT EXISTS claw_agent_session_updated_at
AFTER UPDATE ON claw_agent_session
BEGIN
  UPDATE claw_agent_session SET updated_at = datetime('now', 'localtime') WHERE id = NEW.id;
END;

CREATE INDEX IF NOT EXISTS claw_agent_session_tenant_id_idx  ON claw_agent_session (tenant_id);
CREATE INDEX IF NOT EXISTS claw_agent_session_user_id_idx    ON claw_agent_session (user_id);
CREATE INDEX IF NOT EXISTS claw_agent_session_agent_id_idx   ON claw_agent_session (agent_id);
`
}
