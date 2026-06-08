/** claw_chat_message — 对话消息 */
export function createChatMessage(): string {
  return `
CREATE TABLE IF NOT EXISTS claw_chat_message (
  id            INTEGER  PRIMARY KEY AUTOINCREMENT,
  created_at    TEXT     NOT NULL DEFAULT (datetime('now', 'localtime')),
  updated_at    TEXT     NOT NULL DEFAULT (datetime('now', 'localtime')),
  -- 所属用户 ID（SaaS 多租户隔离）
  tenant_id       INTEGER  NOT NULL DEFAULT 1,
  user_id       INTEGER  NOT NULL DEFAULT 1,
  -- 0 = 未绑定 Agent 的对话
  agent_id     INTEGER  NOT NULL DEFAULT 0,
  -- user | assistant
  role          TEXT     NOT NULL,
  -- JSON 字符串，结构: { text?, role, stage?, source?, timestamp }
  content       TEXT     NOT NULL,
  -- 0 = 正常消息，1 = 已被"清空消息"标记（逻辑删除）
  is_clear      INTEGER  NOT NULL DEFAULT 0
);

CREATE TRIGGER IF NOT EXISTS claw_chat_message_updated_at
AFTER UPDATE ON claw_chat_message
BEGIN
  UPDATE claw_chat_message SET updated_at = datetime('now', 'localtime') WHERE id = NEW.id;
END;

CREATE INDEX IF NOT EXISTS "claw_chat_message_tenant_id_idx" ON "claw_chat_message"(tenant_id);
CREATE INDEX IF NOT EXISTS claw_chat_message_user_id_idx    ON claw_chat_message (user_id);
CREATE INDEX IF NOT EXISTS claw_chat_message_agent_id_idx  ON claw_chat_message (agent_id);
CREATE INDEX IF NOT EXISTS claw_chat_message_created_at_idx ON claw_chat_message (created_at);
`
}
