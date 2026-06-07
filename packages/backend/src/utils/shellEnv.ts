/**
 * Shell 环境变量构建工具
 *
 * 在执行任何 shell 命令之前，调用 buildShellEnv() 获取合并后的环境变量，其中包含：
 * 1. 进程当前环境变量 (process.env)
 * 2. config.shellEnv 中配置的额外变量
 * 3. user_param 表中 Env. 前缀的用户配置环境变量
 * 4. ShellPathList 选项中配置的额外 PATH 路径（合并到 PATH 变量中）
 *
 * 调试/日志辅助：
 * - getShellEnvMeta(userId)   返回额外 PATH 列表和用户自定义 env key 集合
 */

import { config } from '../config'
import { paramDb } from '../storage/store/userParam'
import { getParam } from './userParam'

/** PATH 配置的 option 名称 */
export const SHELL_PATH_LIST_OPTION = 'ShellPathList'

/** 环境变量在 user_param 中的 key 前缀 */
const ENV_PREFIX = 'Env.'

/**
 * 读取用户配置的额外 PATH 路径列表
 */
export async function getShellPathList(): Promise<string[]> {
  try {
    const raw = await getParam(
      config.supervisorTenantId,
      config.supervisorUserId,
      SHELL_PATH_LIST_OPTION,
      '[]'
    )
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return (parsed as unknown[])
      .filter((p): p is string => typeof p === 'string' && p.trim().length > 0)
      .map((p) => p.trim())
  } catch {
    return []
  }
}

/**
 * 构建执行 shell 命令时使用的完整环境变量对象。
 * 合并顺序（后者覆盖前者）：
 *   process.env → config.shellEnv → user_param Env. 条目
 * PATH 变量：ShellPathList 中的路径追加到最前面（优先级最高）。
 */
export async function buildShellEnv(): Promise<NodeJS.ProcessEnv> {
  // 1. 基础：进程 env + config 中额外配置的 shellEnv
  const env: NodeJS.ProcessEnv = { ...process.env, ...config.shellEnv }

  // 2. 注入 user_param 中 Env. 前缀的用户配置环境变量
  try {
    const rows = await paramDb.listByPrefix(
      config.supervisorTenantId,
      config.supervisorUserId,
      ENV_PREFIX
    )
    for (const row of rows) {
      const varName = row.name.startsWith(ENV_PREFIX)
        ? row.name.slice(ENV_PREFIX.length)
        : row.name
      if (varName && varName.trim()) {
        env[varName.trim()] = row.value ?? ''
      }
    }
  } catch {
    // DB 未初始化时忽略
  }

  // 3. 合并用户自定义 PATH 路径：放在最前面，优先级最高
  const extraPaths = await getShellPathList()
  if (extraPaths.length > 0) {
    const currentPath = env.PATH ?? ''
    const separator = process.platform === 'win32' ? ';' : ':'
    const parts = currentPath ? [...extraPaths, currentPath] : extraPaths
    env.PATH = parts.join(separator)
  }

  return env
}

/** 用于日志/调试的 shell 环境元信息 */
export interface ShellEnvMeta {
  /** 用户在 ShellPathList 中配置的额外 PATH 条目 */
  extraPaths: string[]
  /** config.shellEnv + user_param Env. 条目中所有用户自定义 env 的键名（不含值） */
  userEnvKeys: Set<string>
}

/**
 * 收集用于日志/调试的 shell 环境元信息。
 * 与 buildShellEnv() 互补：后者构建真实可用的 env 对象，此函数只收集
 * 需要展示给用户的摘要信息（自定义键名）。
 */
export async function getShellEnvMeta(userId: number): Promise<ShellEnvMeta> {
  const extraPaths = await getShellPathList()
  const userEnvKeys = new Set<string>([
    ...Object.keys(config.shellEnv ?? {}),
    ...(await (async () => {
      try {
        const rows = await paramDb.listByPrefix(
          config.supervisorTenantId,
          userId,
          ENV_PREFIX
        )
        return rows
          .map((r) =>
            r.name.startsWith(ENV_PREFIX)
              ? r.name.slice(ENV_PREFIX.length).trim()
              : r.name.trim()
          )
          .filter(Boolean)
      } catch {
        return []
      }
    })()),
  ])
  return { extraPaths, userEnvKeys }
}
