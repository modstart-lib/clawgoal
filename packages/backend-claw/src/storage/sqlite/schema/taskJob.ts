/** claw_task_job — 智能体作业 */
export function createTaskJob(): string {
  return `
CREATE TABLE IF NOT EXISTS claw_task_job (
  id                       INTEGER  PRIMARY KEY AUTOINCREMENT,
  created_at               TEXT     NOT NULL DEFAULT (datetime('now', 'localtime')),
  updated_at               TEXT     NOT NULL DEFAULT (datetime('now', 'localtime')),
  tenant_id                INTEGER  NOT NULL DEFAULT 1,
  user_id                  INTEGER  NOT NULL DEFAULT 1,
  agent_id                 INTEGER  NOT NULL DEFAULT 0,
  task_id                  INTEGER  NOT NULL DEFAULT 0,
  task_objective_id        INTEGER  NOT NULL DEFAULT 0,
  task_key_result_id       INTEGER  NOT NULL DEFAULT 0,
  -- 一次性任务来源智能体
  source_agent_id          INTEGER  NOT NULL DEFAULT 0,
  sort                     INTEGER  NOT NULL DEFAULT 0,
  -- draft草稿 | ready就绪 | asking待反馈 | running进行中 | success成功 | fail失败 | canceled已取消
  status                   TEXT     NOT NULL DEFAULT 'draft',
  input                    TEXT,
  output                   TEXT,
  meta                     TEXT
);

CREATE TRIGGER IF NOT EXISTS claw_task_job_updated_at
AFTER UPDATE ON claw_task_job
BEGIN
  UPDATE claw_task_job SET updated_at = datetime('now', 'localtime') WHERE id = NEW.id;
END;

CREATE INDEX IF NOT EXISTS claw_task_job_tenant_id_idx ON claw_task_job (tenant_id);
CREATE INDEX IF NOT EXISTS claw_task_job_user_id_idx   ON claw_task_job (user_id);
CREATE INDEX IF NOT EXISTS claw_task_job_agent_id_idx  ON claw_task_job (agent_id);
CREATE INDEX IF NOT EXISTS claw_task_job_task_id_idx   ON claw_task_job (task_id);
CREATE INDEX IF NOT EXISTS claw_task_job_status_idx    ON claw_task_job (status);
`
}
