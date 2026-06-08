/** claw_agent_memory — Agent 按天记忆 */
export function createAgentMemory(): string {
  return `
CREATE TABLE IF NOT EXISTS claw_agent_memory (
  id            INTEGER  PRIMARY KEY AUTOINCREMENT,
  created_at    TEXT     NOT NULL DEFAULT (datetime('now', 'localtime')),
  updated_at    TEXT     NOT NULL DEFAULT (datetime('now', 'localtime')),
  -- 所属用户 ID（SaaS 多租户隔离）
  tenant_id       INTEGER  NOT NULL DEFAULT 1,
  user_id       INTEGER  NOT NULL DEFAULT 1,
  -- 关联 Agent ID
  agent_id      INTEGER  NOT NULL DEFAULT 0,
  -- 日期，格式 YYYY-MM-DD
  day           TEXT     NOT NULL,
  -- 记忆内容（Markdown 格式）
  content       TEXT     NOT NULL DEFAULT '',
  UNIQUE(tenant_id, user_id, agent_id, day)
);

CREATE TRIGGER IF NOT EXISTS claw_agent_memory_updated_at
AFTER UPDATE ON claw_agent_memory
BEGIN
  UPDATE claw_agent_memory SET updated_at = datetime('now', 'localtime') WHERE id = NEW.id;
END;

CREATE INDEX IF NOT EXISTS claw_agent_memory_tenant_id_idx     ON claw_agent_memory (tenant_id);
CREATE INDEX IF NOT EXISTS claw_agent_memory_user_agent_idx ON claw_agent_memory (user_id, agent_id);
CREATE INDEX IF NOT EXISTS claw_agent_memory_day_idx        ON claw_agent_memory (day);
`
}
