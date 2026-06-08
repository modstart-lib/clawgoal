/** claw_agent — Agent 实例持久化 */
export function createAgent(): string {
  return `
CREATE TABLE IF NOT EXISTS claw_agent (
  id            INTEGER  PRIMARY KEY AUTOINCREMENT,
  created_at    TEXT     NOT NULL DEFAULT (datetime('now', 'localtime')),
  updated_at    TEXT     NOT NULL DEFAULT (datetime('now', 'localtime')),
  -- 所属用户 ID（SaaS 多租户隔离）
  tenant_id       INTEGER  NOT NULL DEFAULT 1,
  user_id       INTEGER  NOT NULL DEFAULT 1,
  title         TEXT     NOT NULL,
  role_name     TEXT     NOT NULL,
  -- 1 = 系统内置不可删除, 0 = 用户创建
  is_system     INTEGER  NOT NULL DEFAULT 0,
  enable        INTEGER  NOT NULL DEFAULT 1,
  -- idle = 空闲，working = 工作中
  status        TEXT     NOT NULL DEFAULT 'idle',
  description   TEXT,
  avatar        TEXT,
  -- JSON 字符串，覆盖角色默认配置
  -- 结构: { name?, description?, model?, models?, capabilities? }
  config        TEXT,
  -- JSON 字符串，如 [1,2,3]，存储该 Agent 需要对接的渠道 ID（过滤去重）
  channel_ids    TEXT,
  -- 是否开启 Webhook 推送（0=关闭，1=开启）
  webhook_enable INTEGER NOT NULL DEFAULT 0,
  -- Webhook 鉴权 Token（外部调用 /api/claw/agent/say 时使用）
  webhook_token  TEXT,
  -- JSON 字符串，3D 角色配置（CharacterConfig），与 avatar 字段配合使用
  avatar_config  TEXT,
  -- JSON 字符串，用户为该 Agent 填写的 param 值（对象），由角色 config.yaml param 字段定义
  param          TEXT,
  -- 所属项目 ID（NULL 表示不属于任何项目，即全局 agent 或 supervisor）
  project_id     INTEGER
);

CREATE TRIGGER IF NOT EXISTS claw_agent_updated_at
AFTER UPDATE ON claw_agent
BEGIN
  UPDATE claw_agent SET updated_at = datetime('now', 'localtime') WHERE id = NEW.id;
END;

CREATE INDEX IF NOT EXISTS "claw_agent_tenant_id_idx" ON "claw_agent"(tenant_id);
CREATE INDEX IF NOT EXISTS claw_agent_user_id_idx ON claw_agent (user_id);
CREATE INDEX IF NOT EXISTS claw_agent_project_id_idx ON claw_agent (project_id);
`
}
