/** claw_channel — 系统对接的消息渠道（Telegram / 飞书等） */
export function createChannel(): string {
  return `
CREATE TABLE IF NOT EXISTS claw_channel (
  id            INTEGER  PRIMARY KEY AUTOINCREMENT,
  created_at    TEXT     NOT NULL DEFAULT (datetime('now', 'localtime')),
  updated_at    TEXT     NOT NULL DEFAULT (datetime('now', 'localtime')),
  -- 所属用户 ID（SaaS 多租户隔离）
  tenant_id       INTEGER  NOT NULL DEFAULT 1,
  user_id       INTEGER  NOT NULL DEFAULT 1,
  title         TEXT     NOT NULL,
  enable        INTEGER  NOT NULL DEFAULT 1,
  -- 1 = global channel shared across all agents
  is_global     INTEGER  NOT NULL DEFAULT 0,
  -- telegram | feishu
  type          TEXT     NOT NULL,
  -- JSON 字符串，如 {"token":"xxx","chatId":"yyy"}
  config        TEXT,
  -- pending = 待验证，success = 已成功通讯
  status        TEXT     NOT NULL DEFAULT 'pending'
);

CREATE TRIGGER IF NOT EXISTS claw_channel_updated_at
AFTER UPDATE ON claw_channel
BEGIN
  UPDATE claw_channel SET updated_at = datetime('now', 'localtime') WHERE id = NEW.id;
END;

CREATE INDEX IF NOT EXISTS "claw_channel_tenant_id_idx" ON "claw_channel"(tenant_id);
CREATE INDEX IF NOT EXISTS claw_channel_user_id_idx ON claw_channel (user_id);
`
}
