/** claw_agent_workflow — Agent 执行 workflow 全程记录 */
export function createAgentWorkflow(): string {
  return `
CREATE TABLE IF NOT EXISTS claw_agent_workflow (
  id            INTEGER  PRIMARY KEY AUTOINCREMENT,
  created_at    TEXT     NOT NULL DEFAULT (datetime('now', 'localtime')),
  updated_at    TEXT     NOT NULL DEFAULT (datetime('now', 'localtime')),
  tenant_id     INTEGER  NOT NULL DEFAULT 1,
  user_id       INTEGER  NOT NULL DEFAULT 1,
  agent_id      INTEGER  NOT NULL DEFAULT 0,
  session_id    INTEGER  NOT NULL DEFAULT 0,
  start_at      TEXT,
  end_at        TEXT,
  -- running | success | error
  status        TEXT     NOT NULL DEFAULT 'running',
  -- JSON，任意元数据（如 pipelineName、nodeCount 等）
  state         TEXT     NOT NULL DEFAULT '{}'
);

CREATE TRIGGER IF NOT EXISTS claw_agent_workflow_updated_at
AFTER UPDATE ON claw_agent_workflow
BEGIN
  UPDATE claw_agent_workflow SET updated_at = datetime('now', 'localtime') WHERE id = NEW.id;
END;

CREATE INDEX IF NOT EXISTS claw_agent_workflow_tenant_id_idx ON claw_agent_workflow (tenant_id);
CREATE INDEX IF NOT EXISTS claw_agent_workflow_agent_id_idx ON claw_agent_workflow (agent_id);
CREATE INDEX IF NOT EXISTS claw_agent_workflow_session_id_idx ON claw_agent_workflow (session_id);
`
}
