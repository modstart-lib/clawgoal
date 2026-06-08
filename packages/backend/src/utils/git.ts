/**
 * Git 通用工具函数
 *
 * 封装仓库判断、分支管理、diff 收集、合并等 git 操作。
 * 支持 local（exec async）和 remote runtime（WebSocket）两种执行方式。
 */

import { promises as fs, existsSync } from 'node:fs'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import path from 'node:path'
import { getModelConfigList } from '../config/index.js'
import { modelCall } from '../model/model/index.js'
import { safeJsonParse } from './json.js'

const execFileAsync = promisify(execFile)

// ─── Types ────────────────────────────────────────────────────────────────────

export interface GitRepoConfig {
  name: string
  mainBranch: string
}

export interface GitSpaceConfig {
  repos: GitRepoConfig[]
}

/** shell 执行函数，由调用方注入（支持 local / remote 两种 runtime） */
export type ShellRunner = (command: string, cwd: string) => Promise<string>

// ─── 本地 shell 异步执行器 ────────────────────────────────────────────────────

/** 创建本地 async execFile 执行器 */
export function createLocalShellRunner(): ShellRunner {
  return async (command: string, cwd: string) => {
    try {
      const { stdout, stderr } = await execFileAsync('sh', ['-c', command], {
        cwd,
        encoding: 'utf8',
        timeout: 60_000,
        maxBuffer: 20 * 1024 * 1024,
      })
      return (stdout ?? '') + (stderr ?? '')
    } catch (err: any) {
      return (err.stdout ?? '') + (err.stderr ?? '')
    }
  }
}

// ─── 仓库检测 ─────────────────────────────────────────────────────────────────

/** 判断路径是否是一个 git 仓库（.git 目录存在即可） */
export async function isGitRepo(repoPath: string): Promise<boolean> {
  try {
    await fs.access(path.join(repoPath, '.git'))
    return true
  } catch {
    return false
  }
}

/** 检测仓库的主分支名（main / master / 当前分支） */
export async function detectMainBranch(repoPath: string): Promise<string> {
  try {
    const { stdout: fromOrigin } = await execFileAsync(
      'sh',
      [
        '-c',
        `git -C "${repoPath}" symbolic-ref refs/remotes/origin/HEAD 2>/dev/null | sed 's|refs/remotes/origin/||'`,
      ],
      { encoding: 'utf8', timeout: 5_000 }
    )
    if (fromOrigin.trim()) return fromOrigin.trim()
  } catch {
    /* ignore */
  }

  try {
    const { stdout } = await execFileAsync(
      'sh',
      [
        '-c',
        `git -C "${repoPath}" branch --format='%(refname:short)' 2>/dev/null`,
      ],
      { encoding: 'utf8', timeout: 5_000 }
    )
    const branches = stdout
      .trim()
      .split('\n')
      .map((b) => b.trim())
      .filter(Boolean)
    if (branches.includes('main')) return 'main'
    if (branches.includes('master')) return 'master'
  } catch {
    /* ignore */
  }

  try {
    const { stdout } = await execFileAsync(
      'sh',
      ['-c', `git -C "${repoPath}" rev-parse --abbrev-ref HEAD 2>/dev/null`],
      { encoding: 'utf8', timeout: 5_000 }
    )
    return stdout.trim() || 'main'
  } catch {
    return 'main'
  }
}

/** 扫描目录下所有独立 git 子仓库 */
export async function scanSubRepos(
  gitspacePath: string
): Promise<GitRepoConfig[]> {
  const found: GitRepoConfig[] = []
  try {
    const entries = await fs.readdir(gitspacePath, { withFileTypes: true })
    for (const e of entries) {
      if (!e.isDirectory()) continue
      const repoPath = path.join(gitspacePath, e.name)
      if (!(await isGitRepo(repoPath))) continue
      found.push({ name: e.name, mainBranch: await detectMainBranch(repoPath) })
    }
  } catch {
    /* non-critical */
  }
  return found
}

// ─── 分支操作 ─────────────────────────────────────────────────────────────────

/**
 * 调用大模型根据任务描述生成语义化 feature 名称
 * 返回纯小写英文 + 连字符，最长 20 字符
 */
export async function generateFeatureName(
  taskText: string,
  tenantId: number,
  userId: number
): Promise<string> {
  try {
    const result = await modelCall({
      tenantId,
      userId,
      biz: 'Claw',
      bizId: 'git-branch',
      modelConfigList: await getModelConfigList(userId, tenantId, 'default'),
      systemPrompt:
        'You are a git branch naming assistant. Generate a concise feature name for a git branch based on the task description. Rules: lowercase letters and hyphens only, no spaces, max 20 characters, no prefix like "feat-" or "feature-", just the core concept. Return only the feature name, nothing else.',
      userPrompt: taskText.slice(0, 300),
      temperature: 0.2,
      maxRetry: 2,
      maxTokens: 20,
    })
    const raw = (result.type === 'text' ? result.content : '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 20)
    return raw || 'changes'
  } catch {
    return 'changes'
  }
}

/** 生成带时间戳的分支名：agent/{prefix}_{YYYYMMDDHHMMSS}_{feature} */
export function buildBranchName(prefix: string, feature: string): string {
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  const ts = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`
  return `agent/${prefix}_${ts}_${feature}`
}

/**
 * 强制切到指定分支并恢复干净状态（reset --hard HEAD + clean -fdx），
 * 然后从远程拉取最新代码（git pull），确保开发前始终基于最新主分支。
 * 若当前不在目标分支，打印日志
 */
export async function forceCheckoutBranch(
  repoPath: string,
  branch: string,
  run: ShellRunner
): Promise<void> {
  const currentBranch = (
    await run(
      `git -C "${repoPath}" rev-parse --abbrev-ref HEAD 2>/dev/null`,
      repoPath
    )
  ).trim()
  if (currentBranch !== branch) {
    console.log(
      `[git] 🔧 ${path.basename(repoPath)}: 当前分支 "${currentBranch}" → 切回 ${branch}`
    )
  }
  // 先清理任何残留的 merge/rebase 状态，确保 checkout 能成功
  await run(
    `git -C "${repoPath}" merge --abort 2>/dev/null || true; git -C "${repoPath}" rebase --abort 2>/dev/null || true; git -C "${repoPath}" reset --hard HEAD 2>/dev/null || true; git -C "${repoPath}" clean -fdx 2>/dev/null || true`,
    repoPath
  ).catch(() => {})
  await run(
    `git -C "${repoPath}" checkout -f ${branch} 2>/dev/null || true`,
    repoPath
  )
  await run(
    `git -C "${repoPath}" reset --hard HEAD && git -C "${repoPath}" clean -fdx`,
    repoPath
  )
  // 从远程同步最新主分支（有远程时拉取，无远程时跳过）
  const pullOut = (
    await run(
      `git -C "${repoPath}" pull origin ${branch} 2>&1 || echo 'no-remote'`,
      repoPath
    )
  ).trim()
  if (pullOut !== 'no-remote' && !pullOut.includes('fatal')) {
    console.log(
      `[git] 🔄 ${path.basename(repoPath)}: 已从远程同步 ${branch} (${pullOut.split('\n').pop()?.trim()})`
    )
  }
  const headLog = (
    await run(`git -C "${repoPath}" log --oneline -1 2>/dev/null`, repoPath)
  ).trim()
  console.log(
    `[git] ✅ ${path.basename(repoPath)}: 已恢复到 ${branch} 最新状态 (${headLog})`
  )
}

/**
 * 从当前所在分支切出新开发分支
 * 若同名分支已存在则先删除
 */
export async function createDevBranch(
  repoPath: string,
  devBranch: string,
  run: ShellRunner
): Promise<void> {
  await run(
    `git -C "${repoPath}" branch -D "${devBranch}" 2>/dev/null || true`,
    repoPath
  )
  await run(`git -C "${repoPath}" checkout -b "${devBranch}"`, repoPath)
  console.log(
    `[git] 🌿 ${path.basename(repoPath)}: 已切出开发分支 ${devBranch}`
  )
}

// ─── Diff 收集 ────────────────────────────────────────────────────────────────

/**
 * 收集开发分支相对于主分支的 diff
 * 若开发分支有未提交变更，先自动 commit 后再 diff
 */
export async function collectBranchDiff(
  repoPath: string,
  mainBranch: string,
  devBranch: string,
  run: ShellRunner
): Promise<string> {
  await run(
    `git -C "${repoPath}" checkout ${devBranch} 2>/dev/null || true`,
    repoPath
  )
  const statusOut = (
    await run(`git -C "${repoPath}" status --porcelain`, repoPath)
  ).trim()
  if (statusOut) {
    await run(`git -C "${repoPath}" add -A`, repoPath)
    await run(`git -C "${repoPath}" commit -m "feat: coder changes"`, repoPath)
  }
  return (
    await run(
      `git -C "${repoPath}" diff --binary --no-color ${mainBranch}...${devBranch}`,
      repoPath
    )
  ).trim()
}

// ─── 合并 ─────────────────────────────────────────────────────────────────────

/**
 * 将开发分支 squash merge 到主分支，并创建 commit
 * 合并成功后只推送主分支到远程，开发分支仅保留在本地
 */
export async function squashMergeBranch(
  repoPath: string,
  mainBranch: string,
  devBranch: string,
  commitMessage: string,
  run: ShellRunner
): Promise<{ success: boolean; output: string; isConflict: boolean }> {
  try {
    // 先清理任何残留的 merge/rebase 状态，确保仓库干净
    await run(
      `git -C "${repoPath}" merge --abort 2>/dev/null || true; git -C "${repoPath}" rebase --abort 2>/dev/null || true; git -C "${repoPath}" reset --hard HEAD 2>/dev/null || true; git -C "${repoPath}" clean -fdx 2>/dev/null || true`,
      repoPath
    ).catch(() => {})
    await run(`git -C "${repoPath}" checkout -f ${mainBranch}`, repoPath)
    await run(
      `git -C "${repoPath}" reset --hard HEAD && git -C "${repoPath}" clean -fdx`,
      repoPath
    )
    const mergeOut = await run(
      `git -C "${repoPath}" merge --squash ${devBranch}`,
      repoPath
    )
    if (
      mergeOut.includes('CONFLICT') ||
      mergeOut.includes('Automatic merge failed')
    ) {
      // abort the failed merge to leave the repo in a clean state
      await run(
        `git -C "${repoPath}" merge --abort 2>/dev/null || git -C "${repoPath}" reset --hard HEAD`,
        repoPath
      ).catch(() => {})
      return { success: false, output: mergeOut, isConflict: true }
    }
    await run(
      `git -C "${repoPath}" commit -m "${commitMessage.replace(/"/g, "'")}"`,
      repoPath
    )

    // 推送主分支
    const mainPushOut = (
      await run(
        `git -C "${repoPath}" push -u origin ${mainBranch} 2>&1 || echo 'no-remote'`,
        repoPath
      )
    ).trim()
    const hasRemote =
      mainPushOut !== 'no-remote' &&
      !mainPushOut.includes('fatal') &&
      !mainPushOut.includes('error')
    const mainPushStatus =
      mainPushOut === 'no-remote'
        ? '本地，无远程'
        : hasRemote
          ? '已推送'
          : `推送失败：${mainPushOut}`

    // 开发分支仅保留在本地，不推送到远程
    console.log(
      `[git] 📤 ${path.basename(repoPath)}: main=${mainPushStatus}, devBranch=仅本地保留`
    )
    return {
      success: true,
      output: `${devBranch} → ${mainBranch}（main:${mainPushStatus}）`,
      isConflict: false,
    }
  } catch (err) {
    await run(
      `git -C "${repoPath}" merge --abort 2>/dev/null || true; git -C "${repoPath}" checkout ${mainBranch} 2>/dev/null; git -C "${repoPath}" reset --hard HEAD; git -C "${repoPath}" clean -fdx`,
      repoPath
    ).catch(() => {})
    const errMsg = String(err)
    return {
      success: false,
      output: errMsg,
      isConflict: errMsg.includes('CONFLICT'),
    }
  }
}

// ─── GitSpace 配置管理 ────────────────────────────────────────────────────────

/**
 * 读取或生成 clawgoal.json，并验证所有仓库有效
 * 若仓库存在但不在配置中，自动补全
 */
export async function readOrCreateGitSpaceConfig(
  gitspacePath: string,
  configPath: string
): Promise<GitSpaceConfig> {
  let config: GitSpaceConfig

  if (!existsSync(configPath)) {
    const repos = await scanSubRepos(gitspacePath)
    if (repos.length === 0) {
      throw new Error(
        `gitspace "${gitspacePath}" 下未发现任何 git 仓库。` +
          `请在各子目录中执行 git init && git commit，或手动创建 clawgoal.json。`
      )
    }
    config = { repos }
    await fs.writeFile(configPath, JSON.stringify(config, null, 2), 'utf8')
  } else {
    try {
      config = safeJsonParse(
        await fs.readFile(configPath, 'utf8'),
        {} as GitSpaceConfig,
        'git.config'
      ) as GitSpaceConfig
    } catch {
      throw new Error(`clawgoal.json 解析失败，请检查 ${configPath} 的格式`)
    }
    if (!Array.isArray(config.repos)) {
      throw new Error(`clawgoal.json 格式错误：缺少 repos 数组`)
    }
  }

  // 验证已声明的仓库
  for (const repo of config.repos) {
    const repoPath = path.join(gitspacePath, repo.name)
    if (!(await isGitRepo(repoPath))) {
      throw new Error(
        `clawgoal.json 配置错误：仓库 "${repo.name}" 在 ${repoPath} 不是 git 仓库。` +
          `请执行 git init && git add -A && git commit -m "init"，或从 clawgoal.json 中移除。`
      )
    }
  }

  // 补全未声明的仓库
  const declaredNames = new Set(config.repos.map((r) => r.name))
  const missing = (await scanSubRepos(gitspacePath)).filter(
    (r) => !declaredNames.has(r.name)
  )
  if (missing.length > 0) {
    config.repos.push(...missing)
    await fs.writeFile(configPath, JSON.stringify(config, null, 2), 'utf8')
  }

  if (config.repos.length === 0) {
    throw new Error(
      `clawgoal.json 中 repos 为空，gitspace "${gitspacePath}" 没有配置任何仓库。`
    )
  }

  return config
}
