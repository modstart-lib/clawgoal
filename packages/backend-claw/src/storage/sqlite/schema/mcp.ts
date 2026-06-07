/** claw_mcp — MCP 服务配置 */
export function createMcp(): string {
  return `
CREATE TABLE IF NOT EXISTS claw_mcp (
  id            INTEGER  PRIMARY KEY AUTOINCREMENT,
  created_at    TEXT     NOT NULL DEFAULT (datetime('now', 'localtime')),
  updated_at    TEXT     NOT NULL DEFAULT (datetime('now', 'localtime')),
  -- 所属用户 ID（SaaS 多租户隔离）
  tenant_id       INTEGER  NOT NULL DEFAULT 1,
  user_id       INTEGER  NOT NULL DEFAULT 1,
  -- 唯一标识，用于 capabilities.mcps 数组引用，如 "filesystem"，在同一用户下唯一
  name          TEXT     NOT NULL,
  -- 显示名称，如 "文件系统 MCP"
  title         TEXT     NOT NULL,
  -- stdio | sse | http
  type          TEXT     NOT NULL DEFAULT 'stdio',
  enable        INTEGER  NOT NULL DEFAULT 1,
  -- JSON 字符串：stdio={command,args,env} / sse|http={url,headers}
  config        TEXT,
  -- disconnected | connecting | connected | disconnecting | error
  status        TEXT     NOT NULL DEFAULT 'disconnected',
  description   TEXT,
  -- JSON 数组：[{name, description, inputSchema}]，连接成功后写入
  tools         TEXT
);

CREATE TRIGGER IF NOT EXISTS claw_mcp_updated_at
AFTER UPDATE ON claw_mcp
BEGIN
  UPDATE claw_mcp SET updated_at = datetime('now', 'localtime') WHERE id = NEW.id;
END;

CREATE UNIQUE INDEX IF NOT EXISTS claw_mcp_user_name_idx ON claw_mcp (user_id, name);
CREATE INDEX IF NOT EXISTS "claw_mcp_tenant_id_idx" ON "claw_mcp"(tenant_id);
CREATE INDEX IF NOT EXISTS claw_mcp_user_id_idx ON claw_mcp (user_id);
`
}
