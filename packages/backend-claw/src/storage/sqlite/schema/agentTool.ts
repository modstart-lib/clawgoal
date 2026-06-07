/** claw_agent_tool — 工具调用记录 */
export function createAgentTool(): string {
  return `
CREATE TABLE IF NOT EXISTS claw_agent_tool (
  id            INTEGER  PRIMARY KEY AUTOINCREMENT,
  created_at    TEXT     NOT NULL DEFAULT (datetime('now', 'localtime')),
  updated_at    TEXT     NOT NULL DEFAULT (datetime('now', 'localtime')),
  tenant_id     INTEGER  NOT NULL DEFAULT 1,
  user_id       INTEGER  NOT NULL DEFAULT 1,
  agent_id      INTEGER  NOT NULL DEFAULT 0,
  session_id    INTEGER  NOT NULL DEFAULT 0,
  -- 工具调用唯一 ID（与 tool:start/tool:end 事件中的 toolCallId 对应）
  tool_call_id  TEXT     NOT NULL DEFAULT '',
  -- 工具名称（如 runtime_execute、shell、web 等）
  tool_name     TEXT     NOT NULL DEFAULT '',
  -- 调用参数 JSON
  params        TEXT     NOT NULL DEFAULT '{}',
  -- running | success | error
  status        TEXT     NOT NULL DEFAULT 'running',
  -- 执行耗时（毫秒）
  duration_ms   INTEGER  NOT NULL DEFAULT 0,
  -- 工具返回结果（截断后）
  result        TEXT     NOT NULL DEFAULT '',
  -- 详细执行日志（逐行追加，适合 runtime_execute 等长日志工具）
  logs          TEXT     NOT NULL DEFAULT ''
);

CREATE TRIGGER IF NOT EXISTS claw_agent_tool_updated_at
AFTER UPDATE ON claw_agent_tool
BEGIN
  UPDATE claw_agent_tool SET updated_at = datetime('now', 'localtime') WHERE id = NEW.id;
END;

CREATE INDEX IF NOT EXISTS claw_agent_tool_tenant_id_idx   ON claw_agent_tool (tenant_id);
CREATE INDEX IF NOT EXISTS claw_agent_tool_agent_id_idx    ON claw_agent_tool (agent_id);
CREATE INDEX IF NOT EXISTS claw_agent_tool_session_id_idx  ON claw_agent_tool (session_id);
CREATE INDEX IF NOT EXISTS claw_agent_tool_tool_call_id_idx ON claw_agent_tool (tool_call_id);
`
}
