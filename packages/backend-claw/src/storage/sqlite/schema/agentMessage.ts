/** claw_agent_message — 对话消息 */
export function createAgentMessage(): string {
  return `
CREATE TABLE IF NOT EXISTS claw_agent_message (
  id            INTEGER  PRIMARY KEY AUTOINCREMENT,
  created_at    TEXT     NOT NULL DEFAULT (datetime('now', 'localtime')),
  updated_at    TEXT     NOT NULL DEFAULT (datetime('now', 'localtime')),
  tenant_id       INTEGER  NOT NULL DEFAULT 1,
  user_id       INTEGER  NOT NULL DEFAULT 1,
  agent_id     INTEGER  NOT NULL DEFAULT 0,
  session_id    INTEGER  NOT NULL DEFAULT 0,
  -- user | assistant
  role          TEXT     NOT NULL,
  -- JSON 字符串，结构: { text?, role, stage?, source?, timestamp }
  content       TEXT     NOT NULL,
  -- 0 = 正常消息，1 = 已被"清空消息"标记（逻辑删除）
  is_clear      INTEGER  NOT NULL DEFAULT 0
);

CREATE TRIGGER IF NOT EXISTS claw_agent_message_updated_at
AFTER UPDATE ON claw_agent_message
BEGIN
  UPDATE claw_agent_message SET updated_at = datetime('now', 'localtime') WHERE id = NEW.id;
END;

CREATE INDEX IF NOT EXISTS claw_agent_message_tenant_id_idx  ON claw_agent_message (tenant_id);
CREATE INDEX IF NOT EXISTS claw_agent_message_user_id_idx    ON claw_agent_message (user_id);
CREATE INDEX IF NOT EXISTS claw_agent_message_agent_id_idx   ON claw_agent_message (agent_id);
CREATE INDEX IF NOT EXISTS claw_agent_message_session_id_idx ON claw_agent_message (session_id);
CREATE INDEX IF NOT EXISTS claw_agent_message_created_at_idx ON claw_agent_message (created_at);
`
}
