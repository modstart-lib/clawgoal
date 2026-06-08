/** claw_metric — 项目指标定义 */
export function createMetric(): string {
  return `
CREATE TABLE IF NOT EXISTS claw_metric (
  id            INTEGER  PRIMARY KEY AUTOINCREMENT,
  created_at    TEXT     NOT NULL DEFAULT (datetime('now', 'localtime')),
  updated_at    TEXT     NOT NULL DEFAULT (datetime('now', 'localtime')),
  -- 关联项目 ID
  project_id    INTEGER  NOT NULL,
  -- 指标英文标识，如 income / visit
  name          TEXT     NOT NULL,
  -- 指标显示名称，如 收入 / 访问量
  title         TEXT     NOT NULL,
  -- 排序序号，越小越靠前
  sort          INTEGER  NOT NULL DEFAULT 0,
  -- 备注说明
  remark        TEXT,
  -- 顶部卡片汇总模式：sum（求和）或 avg（平均），默认 sum
  summary_mode  TEXT     NOT NULL DEFAULT 'sum'
);

CREATE TRIGGER IF NOT EXISTS claw_metric_updated_at
AFTER UPDATE ON claw_metric
BEGIN
  UPDATE claw_metric SET updated_at = datetime('now', 'localtime') WHERE id = NEW.id;
END;

CREATE INDEX IF NOT EXISTS claw_metric_project_id_idx ON claw_metric (project_id);
CREATE UNIQUE INDEX IF NOT EXISTS claw_metric_project_name_idx ON claw_metric (project_id, name);
`
}
