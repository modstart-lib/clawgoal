/** claw_task — Agent 任务 */
export function createTask(): string {
  return `
CREATE TABLE IF NOT EXISTS claw_task (
  id            INTEGER  PRIMARY KEY AUTOINCREMENT,
  created_at    TEXT     NOT NULL DEFAULT (datetime('now', 'localtime')),
  updated_at    TEXT     NOT NULL DEFAULT (datetime('now', 'localtime')),
  -- 所属用户 ID（SaaS 多租户隔离）
  tenant_id       INTEGER  NOT NULL DEFAULT 1,
  user_id       INTEGER  NOT NULL DEFAULT 1,
  -- 关联的 Agent（可选）
  agent_id     INTEGER,
  -- 任务开始时间
  start_at      TEXT,
  -- 任务结束时间
  end_at        TEXT,
  -- draft=草稿, queue=队列（等待依赖）, pending=等待子任务完成, ready=就绪, asking=待反馈, running=进行中, success=成功, fail=失败, canceled=已取消
  status        TEXT     NOT NULL DEFAULT 'draft',
  -- 状态备注（错误信息等）
  status_remark TEXT,
  -- 任务标题
  title         TEXT     NOT NULL,
  -- 任务描述
  description   TEXT,
  -- 正在进行的工作描述（实时更新，完成后置空）
  processing    TEXT,
  -- 执行结果汇总（成功/失败后写入）
  result        TEXT,
  -- 关联目标 ID（0=无）
  objective_id    INTEGER  NOT NULL DEFAULT 0,
  -- 关联关键结果 ID（0=无；objective_id=0 且 key_result_id=0 表示口头任务）
  key_result_id   INTEGER  NOT NULL DEFAULT 0,
  -- 执行会话 ID（用于反馈流程与历史查询，0 = 无）
  session_id      INTEGER  NOT NULL DEFAULT 0,
  -- 截止时间
  due_at        TEXT,
  -- 预计耗时（小时）
  estimated_hours REAL,
  -- 共享内容（JSON 字符串），同一任务下多个 action 可共享
  shared_content  TEXT,
  -- 来源：manual=手动创建, objective=目标驱动
  source          TEXT     NOT NULL DEFAULT 'manual',
  -- 父级任务 ID（0 表示顶级任务；不为 0 表示子任务）
  parent_id       INTEGER  NOT NULL DEFAULT 0,
  -- 根任务 ID（0 表示自身为根；子任务指向根节点 ID，便于递归树形查询）
  root_id         INTEGER  NOT NULL DEFAULT 0,
  -- 同级任务排序值（同一父任务下按升序排列）
  sort            INTEGER  NOT NULL DEFAULT 0,
  -- 依赖任务 ID 列表（JSON 数组），仅当所有依赖任务都 success 后，才可从 queue 晋升为 ready
  needs           TEXT     NOT NULL DEFAULT '[]',
  -- 所属项目 ID（NULL 表示不属于任何项目）
  project_id      INTEGER,
  -- 执行日志（JSON 数组，每条为一个进度条目）
  logs            TEXT     NOT NULL DEFAULT '[]'
);

CREATE TRIGGER IF NOT EXISTS claw_task_updated_at
AFTER UPDATE ON claw_task
BEGIN
  UPDATE claw_task SET updated_at = datetime('now', 'localtime') WHERE id = NEW.id;
END;

CREATE INDEX IF NOT EXISTS "claw_task_tenant_id_idx" ON "claw_task"(tenant_id);
CREATE INDEX IF NOT EXISTS claw_task_user_id_idx    ON claw_task (user_id);
CREATE INDEX IF NOT EXISTS claw_task_agent_id_idx  ON claw_task (agent_id);
CREATE INDEX IF NOT EXISTS claw_task_status_idx     ON claw_task (status);
CREATE INDEX IF NOT EXISTS claw_task_created_at_idx ON claw_task (created_at);
CREATE INDEX IF NOT EXISTS claw_task_parent_id_idx ON claw_task (parent_id);
CREATE INDEX IF NOT EXISTS claw_task_root_id_idx ON claw_task (root_id);
CREATE INDEX IF NOT EXISTS claw_task_project_id_idx ON claw_task (project_id);
`
}
