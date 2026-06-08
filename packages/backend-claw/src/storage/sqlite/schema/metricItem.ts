/** claw_metric_item — 项目指标数据条目 */
export function createMetricItem(): string {
  return `
CREATE TABLE IF NOT EXISTS claw_metric_item (
  id            INTEGER  PRIMARY KEY AUTOINCREMENT,
  created_at    TEXT     NOT NULL DEFAULT (datetime('now', 'localtime')),
  updated_at    TEXT     NOT NULL DEFAULT (datetime('now', 'localtime')),
  -- 关联项目 ID
  project_id    INTEGER  NOT NULL,
  -- 日期，格式 YYYY-MM-DD
  day           TEXT     NOT NULL,
  -- 指标名称（对应 claw_metric.name）
  name          TEXT     NOT NULL,
  -- 指标数值，支持小数
  value         REAL     NOT NULL DEFAULT 0,
  -- 备注说明
  remark        TEXT
);

CREATE TRIGGER IF NOT EXISTS claw_metric_item_updated_at
AFTER UPDATE ON claw_metric_item
BEGIN
  UPDATE claw_metric_item SET updated_at = datetime('now', 'localtime') WHERE id = NEW.id;
END;

CREATE INDEX IF NOT EXISTS claw_metric_item_project_id_idx ON claw_metric_item (project_id);
CREATE INDEX IF NOT EXISTS claw_metric_item_day_idx         ON claw_metric_item (day);
CREATE UNIQUE INDEX IF NOT EXISTS claw_metric_item_unique_idx ON claw_metric_item (project_id, day, name);
`
}
