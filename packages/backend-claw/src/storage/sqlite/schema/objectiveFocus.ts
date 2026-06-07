/** claw_objective_focus — AI分析当前应该聚焦的事项（由 AI 根据目标和事项分析生成，不是“专注功能”） */
export function createObjectiveFocus(): string {
  return `
CREATE TABLE IF NOT EXISTS claw_objective_focus (
  id            INTEGER  PRIMARY KEY AUTOINCREMENT,
  created_at    TEXT     NOT NULL DEFAULT (datetime('now', 'localtime')),
  updated_at    TEXT     NOT NULL DEFAULT (datetime('now', 'localtime')),
  -- 所属用户 ID（SaaS 多租户隔离）
  tenant_id     INTEGER  NOT NULL DEFAULT 1,
  user_id       INTEGER  NOT NULL DEFAULT 1,
  -- 本次聚焦选中的 action id 列表（JSON 数组）
  action_ids    TEXT,
  -- AI 提取的这几个Action的时间点（年月日时分秒）
  time          TEXT
);

CREATE TRIGGER IF NOT EXISTS claw_objective_focus_updated_at
AFTER UPDATE ON claw_objective_focus
BEGIN
  UPDATE claw_objective_focus SET updated_at = datetime('now', 'localtime') WHERE id = NEW.id;
END;

CREATE INDEX IF NOT EXISTS "claw_objective_focus_tenant_id_idx" ON "claw_objective_focus"(tenant_id);
CREATE INDEX IF NOT EXISTS claw_objective_focus_user_id_idx    ON claw_objective_focus (user_id);
CREATE INDEX IF NOT EXISTS claw_objective_focus_created_at_idx ON claw_objective_focus (created_at);
`
}
