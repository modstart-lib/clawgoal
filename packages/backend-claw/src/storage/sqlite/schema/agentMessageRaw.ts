/** claw_agent_message_raw — 模型对话原始消息记录 */
export function createAgentMessageRaw(): string {
  return `
CREATE TABLE IF NOT EXISTS claw_agent_message_raw (
  id            INTEGER  PRIMARY KEY AUTOINCREMENT,
  created_at    TEXT     NOT NULL DEFAULT (datetime('now', 'localtime')),
  updated_at    TEXT     NOT NULL DEFAULT (datetime('now', 'localtime')),
  tenant_id     INTEGER  NOT NULL DEFAULT 1,
  user_id       INTEGER  NOT NULL DEFAULT 1,
  session_id    INTEGER  NOT NULL DEFAULT 0,
  -- 完整的模型消息 JSON（含 role、content、tool_calls 等）
  message       TEXT     NOT NULL
);

CREATE TRIGGER IF NOT EXISTS claw_agent_message_raw_updated_at
AFTER UPDATE ON claw_agent_message_raw
BEGIN
  UPDATE claw_agent_message_raw SET updated_at = datetime('now', 'localtime') WHERE id = NEW.id;
END;

CREATE INDEX IF NOT EXISTS claw_agent_message_raw_tenant_id_idx  ON claw_agent_message_raw (tenant_id);
CREATE INDEX IF NOT EXISTS claw_agent_message_raw_user_id_idx    ON claw_agent_message_raw (user_id);
CREATE INDEX IF NOT EXISTS claw_agent_message_raw_session_id_idx ON claw_agent_message_raw (session_id);
CREATE INDEX IF NOT EXISTS claw_agent_message_raw_created_at_idx ON claw_agent_message_raw (created_at);
`
}
