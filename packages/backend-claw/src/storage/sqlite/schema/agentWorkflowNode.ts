/** claw_agent_workflow_node — Agent workflow 单节点执行记录 */
export function createAgentWorkflowNode(): string {
  return `
CREATE TABLE IF NOT EXISTS claw_agent_workflow_node (
  id            INTEGER  PRIMARY KEY AUTOINCREMENT,
  created_at    TEXT     NOT NULL DEFAULT (datetime('now', 'localtime')),
  updated_at    TEXT     NOT NULL DEFAULT (datetime('now', 'localtime')),
  tenant_id     INTEGER  NOT NULL DEFAULT 1,
  user_id       INTEGER  NOT NULL DEFAULT 1,
  agent_id      INTEGER  NOT NULL DEFAULT 0,
  session_id    INTEGER  NOT NULL DEFAULT 0,
  workflow_id   INTEGER  NOT NULL DEFAULT 0,
  start_at      TEXT,
  end_at        TEXT,
  -- running | success | error | skip
  status        TEXT     NOT NULL DEFAULT 'running',
  -- JSON，节点入参（runInputs）
  input         TEXT     NOT NULL DEFAULT '{}',
  -- JSON，节点出参（runOutputs）
  output        TEXT     NOT NULL DEFAULT '{}',
  -- JSON，节点元数据（nodeId、nodeType、nodeTitle）
  state         TEXT     NOT NULL DEFAULT '{}',
  -- JSON 数组，节点执行过程日志
  logs          TEXT     NOT NULL DEFAULT '[]'
);

CREATE TRIGGER IF NOT EXISTS claw_agent_workflow_node_updated_at
AFTER UPDATE ON claw_agent_workflow_node
BEGIN
  UPDATE claw_agent_workflow_node SET updated_at = datetime('now', 'localtime') WHERE id = NEW.id;
END;

CREATE INDEX IF NOT EXISTS claw_agent_workflow_node_tenant_id_idx ON claw_agent_workflow_node (tenant_id);
CREATE INDEX IF NOT EXISTS claw_agent_workflow_node_agent_id_idx ON claw_agent_workflow_node (agent_id);
CREATE INDEX IF NOT EXISTS claw_agent_workflow_node_workflow_id_idx ON claw_agent_workflow_node (workflow_id);
`
}
