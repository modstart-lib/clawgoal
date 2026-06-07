/** claw_agent_workflow_message — workflow 内部 AI 模型消息记录（不写入主会话历史） */
export function createAgentWorkflowMessage(): string {
  return `
CREATE TABLE IF NOT EXISTS claw_agent_workflow_message (
  id           INTEGER  PRIMARY KEY AUTOINCREMENT,
  created_at   TEXT     NOT NULL DEFAULT (datetime('now', 'localtime')),
  updated_at   TEXT     NOT NULL DEFAULT (datetime('now', 'localtime')),
  tenant_id    INTEGER  NOT NULL DEFAULT 1,
  user_id      INTEGER  NOT NULL DEFAULT 1,
  workflow_id  INTEGER  NOT NULL DEFAULT 0,
  session_id   INTEGER  NOT NULL DEFAULT 0,
  -- 完整的模型消息 JSON（含 role、content、tool_calls 等）
  message      TEXT     NOT NULL
);

CREATE TRIGGER IF NOT EXISTS claw_agent_workflow_message_updated_at
AFTER UPDATE ON claw_agent_workflow_message
BEGIN
  UPDATE claw_agent_workflow_message SET updated_at = datetime('now', 'localtime') WHERE id = NEW.id;
END;

CREATE INDEX IF NOT EXISTS claw_agent_workflow_message_workflow_id_idx ON claw_agent_workflow_message (workflow_id);
CREATE INDEX IF NOT EXISTS claw_agent_workflow_message_tenant_id_idx   ON claw_agent_workflow_message (tenant_id);
CREATE INDEX IF NOT EXISTS claw_agent_workflow_message_session_id_idx  ON claw_agent_workflow_message (session_id);
`
}
