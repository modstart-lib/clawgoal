/** claw_agent_audit — AI 开发完成后等待用户审核的 diff 记录 */
export function createAgentAudit(): string {
  return `
CREATE TABLE IF NOT EXISTS claw_agent_audit (
  id            INTEGER  PRIMARY KEY AUTOINCREMENT,
  created_at    TEXT     NOT NULL DEFAULT (datetime('now', 'localtime')),
  updated_at    TEXT     NOT NULL DEFAULT (datetime('now', 'localtime')),
  tenant_id     INTEGER  NOT NULL DEFAULT 1,
  user_id       INTEGER  NOT NULL DEFAULT 1,
  agent_id      INTEGER  NOT NULL DEFAULT 0,
  task_id       INTEGER  NOT NULL DEFAULT 0,
  session_id    INTEGER  NOT NULL DEFAULT 0,
  -- diff | (reserved for future types)
  type          TEXT     NOT NULL DEFAULT 'diff',
  -- JSON: { diffs: {[project]: string}, summary: string, review?: { comments: [{file, text}], rejectMessage: string } }
  content       TEXT     NOT NULL DEFAULT '{}',
  -- pending | approved | rejected
  status        TEXT     NOT NULL DEFAULT 'pending'
);

CREATE TRIGGER IF NOT EXISTS claw_agent_audit_updated_at
AFTER UPDATE ON claw_agent_audit
BEGIN
  UPDATE claw_agent_audit SET updated_at = datetime('now', 'localtime') WHERE id = NEW.id;
END;

CREATE INDEX IF NOT EXISTS claw_agent_audit_tenant_id_idx ON claw_agent_audit (tenant_id);
CREATE INDEX IF NOT EXISTS claw_agent_audit_agent_id_idx ON claw_agent_audit (agent_id);
CREATE INDEX IF NOT EXISTS claw_agent_audit_session_id_idx ON claw_agent_audit (session_id);
`
}
