/**
 * audit_codespace_accept — creates branch, applies patch, merges to main branch.
 * audit_codespace_change — restores diff to working directory so coder can iterate.
 * audit_codespace_cancel — cancels the entire workflow.
 *
 * Note: audit creation is handled automatically by runtime_execute when diff is present.
 */

import { spawnSync } from 'node:child_process'
import { writeFileSync, rmSync, existsSync } from 'node:fs'
import path from 'node:path'
import { generateTempFile } from '../../../backend/src/utils/utils.js'
import { clawDb } from '../storage/store/index.js'
import { clawEventBus } from '../kernel/eventBus.js'
import { createLogger } from '../kernel/logger.js'
import { getClawRuntimeWs } from '../index.js'
import type { ToolContext, ToolDefinition, ToolResult } from '../types/index.js'

const logger = createLogger('tool:audit_codespace')

/** 从 unified diff 文本中提取新增文件的路径（相对路径） */
function extractNewFilePaths(diff: string): string[] {
  const paths: string[] = []
  const lines = diff.split('\n')
  for (let i = 0; i < lines.length; i++) {
    if (lines[i]!.startsWith('new file mode')) {
      // 往前找 +++ b/ 行
      for (let j = i + 1; j < Math.min(i + 4, lines.length); j++) {
        const m = lines[j]!.match(/^\+\+\+ b\/(.+)$/)
        if (m) {
          paths.push(m[1]!)
          break
        }
      }
    }
  }
  return paths
}

/** 在指定 runtime 上运行 shell 命令，返回 stdout+stderr 拼接结果 */
async function runShell(
  runtimeName: string,
  command: string,
  cwd: string,
  tenantId: number,
  userId: number
): Promise<string> {
  if (runtimeName === 'local') {
    const result = spawnSync('sh', ['-c', command], {
      cwd,
      encoding: 'utf8',
      timeout: 60_000,
      maxBuffer: 20 * 1024 * 1024,
    })
    return (result.stdout ?? '') + (result.stderr ?? '')
  }
  const dbRuntime = clawDb.findRuntimeByName(tenantId, userId, runtimeName)
  if (!dbRuntime || dbRuntime.status !== 'online') return ''
  const result = await getClawRuntimeWs().requestShell(
    dbRuntime.id,
    command,
    cwd,
    60_000
  )
  return result.output ?? ''
}

/** 将存储在 DB 中的 diff 应用到代码仓库 */
async function applyAuditDiff(
  diffs: Record<string, string | null>,
  codespace: string,
  runtime_name: string,
  tenantId: number,
  userId: number
): Promise<string[]> {
  const results: string[] = []

  for (const [repoName, diff] of Object.entries(diffs)) {
    if (!diff || !diff.trim()) {
      results.push(`[${repoName}]: no changes`)
      continue
    }

    const repoPath =
      repoName === '<codespace>' || repoName === path.basename(codespace)
        ? codespace
        : `${codespace}/${repoName}`

    const tmpFile = generateTempFile('patch', 'audit_patch')

    try {
      if (runtime_name === 'local') {
        writeFileSync(tmpFile, diff, 'utf8')
        const result = spawnSync(
          'sh',
          ['-c', `git -C "${repoPath}" apply --whitespace=nowarn "${tmpFile}"`],
          { encoding: 'utf8', timeout: 30_000 }
        )
        const out = ((result.stdout ?? '') + (result.stderr ?? '')).trim()
        results.push(`[${repoName}]: ${out || 'applied successfully'}`)
      } else {
        const dbRuntime = clawDb.findRuntimeByName(
          tenantId,
          userId,
          runtime_name
        )
        if (!dbRuntime || dbRuntime.status !== 'online') {
          results.push(`[${repoName}]: runtime "${runtime_name}" not available`)
          continue
        }
        await getClawRuntimeWs().requestFileWrite(
          dbRuntime.id,
          tmpFile,
          diff,
          false
        )
        const out = await getClawRuntimeWs().requestShell(
          dbRuntime.id,
          `git -C "${repoPath}" apply --whitespace=nowarn "${tmpFile}"`,
          codespace,
          30_000
        )
        results.push(
          `[${repoName}]: ${out.output?.trim() || 'applied successfully'}`
        )
      }
    } catch (err) {
      results.push(`[${repoName}]: error — ${String(err)}`)
    }
  }

  return results
}

// ─── audit_codespace_accept ───────────────────────────────────────────────────

export const auditCodespaceAcceptDefinition: ToolDefinition = {
  name: 'audit_codespace_accept',
  description:
    'Accept an approved audit: creates a new feature branch, applies the stored diff patch, ' +
    'commits, merges the branch into the default branch, and pushes. ' +
    'Fails if the audit has already been processed (not pending).',
  parameters: {
    type: 'object',
    properties: {
      audit_id: {
        type: 'number',
        description: 'Audit ID returned by audit_codespace_submit.',
      },
      codespace: {
        type: 'string',
        description:
          'Absolute path to the git repository (the working directory).',
      },
      runtime_name: {
        type: 'string',
        description: 'Runtime name where the codespace lives (e.g. "local").',
      },
    },
    required: ['audit_id', 'codespace', 'runtime_name'],
  },
}

export async function auditCodespaceAcceptTool(
  args: { audit_id: number; codespace: string; runtime_name: string },
  context: ToolContext
): Promise<ToolResult> {
  const { audit_id, codespace, runtime_name } = args
  const { agentContext } = context
  const { userId, tenantId } = agentContext

  const audit = clawDb.findAgentAuditByIdAndUser(audit_id, userId)
  if (!audit) {
    return {
      success: false,
      output: `Audit #${audit_id} not found or access denied.`,
      error: `Audit #${audit_id} not found or access denied.`,
    }
  }
  if (audit.status !== 'pending') {
    return {
      success: false,
      output: `Audit #${audit_id} has already been processed (status: ${audit.status}).`,
      error: `Audit #${audit_id} has already been processed (status: ${audit.status}).`,
    }
  }

  const content: {
    diffs: Record<string, string | null>
    summary?: string
    diffStat?: string
  } =
    typeof audit.content === 'string'
      ? JSON.parse(audit.content)
      : audit.content
  const diffs = content.diffs ?? {}
  const summary = content.summary ?? 'apply changes'
  const diffStat = content.diffStat ?? ''

  const nonNullDiffs = Object.entries(diffs).filter(([, d]) => d && d.trim())
  if (nonNullDiffs.length === 0) {
    clawDb.updateAgentAudit(audit_id, { status: 'approved' })
    return {
      success: true,
      output: 'No changes to apply. Audit marked approved.',
    }
  }

  const branchName = `feat/audit-${audit_id}`
  const results: string[] = []
  let failCount = 0
  const succeededRepos: string[] = []
  const failedRepos: string[] = []

  for (const [repoName, diff] of Object.entries(diffs)) {
    if (!diff || !diff.trim()) {
      results.push(`[${repoName}]: no changes`)
      continue
    }

    const isRoot =
      repoName === '<codespace>' || repoName === path.basename(codespace)
    const repoPath = isRoot ? codespace : `${codespace}/${repoName}`
    const repoLabel = isRoot ? path.basename(codespace) : repoName

    const defaultBranch =
      (
        await runShell(
          runtime_name,
          `git -C "${repoPath}" symbolic-ref refs/remotes/origin/HEAD 2>/dev/null | sed 's|refs/remotes/origin/||' || echo main`,
          repoPath,
          tenantId,
          userId
        )
      ).trim() || 'main'

    const tmpFile = generateTempFile('patch', 'audit_accept')

    try {
      // 重置工作区：clean -fdx 含 .gitignore 文件，确保残留文件被清除
      const resetCmd = `git -C "${repoPath}" reset --hard HEAD && git -C "${repoPath}" clean -fdx`
      await runShell(runtime_name, resetCmd, repoPath, tenantId, userId)
      await runShell(
        runtime_name,
        `git -C "${repoPath}" checkout ${defaultBranch}`,
        repoPath,
        tenantId,
        userId
      )
      await runShell(runtime_name, resetCmd, repoPath, tenantId, userId)

      // 删除已存在的 feature branch（避免 checkout -b 失败后静默继续）
      await runShell(
        runtime_name,
        `git -C "${repoPath}" branch -D ${branchName} 2>/dev/null || true`,
        repoPath,
        tenantId,
        userId
      )
      await runShell(
        runtime_name,
        `git -C "${repoPath}" checkout -b ${branchName}`,
        repoPath,
        tenantId,
        userId
      )

      // apply 前强制删除 diff 中的新增文件（防止 "already exists in working directory"）
      if (runtime_name === 'local') {
        const newFiles = extractNewFilePaths(diff)
        for (const f of newFiles) {
          const fullPath = path.join(repoPath, f)
          if (existsSync(fullPath)) {
            rmSync(fullPath, { force: true })
          }
        }
      }

      if (runtime_name === 'local') {
        writeFileSync(tmpFile, diff, 'utf8')
        const applyOut = spawnSync(
          'sh',
          ['-c', `git -C "${repoPath}" apply "${tmpFile}"`],
          { encoding: 'utf8', timeout: 30_000 }
        )
        const applyResult = (
          (applyOut.stdout ?? '') + (applyOut.stderr ?? '')
        ).trim()
        if (applyOut.status !== 0)
          throw new Error(applyResult || 'git apply failed')
      } else {
        const dbRuntime = clawDb.findRuntimeByName(
          tenantId,
          userId,
          runtime_name
        )
        if (!dbRuntime || dbRuntime.status !== 'online') {
          throw new Error(`runtime "${runtime_name}" not available`)
        }
        await getClawRuntimeWs().requestFileWrite(
          dbRuntime.id,
          tmpFile,
          diff,
          false
        )
        const out = await getClawRuntimeWs().requestShell(
          dbRuntime.id,
          `git -C "${repoPath}" apply "${tmpFile}"`,
          repoPath,
          30_000
        )
        if (out.output?.includes('error:')) throw new Error(out.output)
      }

      await runShell(
        runtime_name,
        `git -C "${repoPath}" add -A`,
        repoPath,
        tenantId,
        userId
      )
      const commitOut = await runShell(
        runtime_name,
        `git -C "${repoPath}" commit -m "feat: ${summary.replace(/"/g, "'")}"`,
        repoPath,
        tenantId,
        userId
      )
      await runShell(
        runtime_name,
        `git -C "${repoPath}" checkout ${defaultBranch}`,
        repoPath,
        tenantId,
        userId
      )
      const mergeOut = await runShell(
        runtime_name,
        `git -C "${repoPath}" merge --squash ${branchName}`,
        repoPath,
        tenantId,
        userId
      )
      // Detect merge conflicts
      if (
        mergeOut.includes('CONFLICT') ||
        mergeOut.includes('Automatic merge failed')
      ) {
        throw new Error(
          `合并冲突，请在 coder 中解决后重新提交：\n${mergeOut.trim()}`
        )
      }
      // Single squash commit on main
      await runShell(
        runtime_name,
        `git -C "${repoPath}" commit -m "feat: ${summary.replace(/"/g, "'")}"`,
        repoPath,
        tenantId,
        userId
      )
      const pushOut = await runShell(
        runtime_name,
        `git -C "${repoPath}" remote 2>/dev/null | head -1 | grep -q . && (git -C "${repoPath}" push -u origin ${defaultBranch} 2>&1 || git -C "${repoPath}" push 2>&1) || echo 'no-remote'`,
        repoPath,
        tenantId,
        userId
      )

      const pushed = pushOut.trim()
      const pushFailed =
        pushed &&
        pushed !== 'no-remote' &&
        (pushed.includes('fatal') || pushed.includes('error'))
      results.push(
        `[${repoLabel}]: ${branchName} → ${defaultBranch}${
          pushFailed
            ? `（推送失败：${pushed}）`
            : pushed === 'no-remote'
              ? '（本地合并，无远程）'
              : '（已推送）'
        }`
      )
      succeededRepos.push(repoLabel)
    } catch (err) {
      const errMsg = String(err)
      const isConflict =
        errMsg.includes('合并冲突') || errMsg.includes('CONFLICT')
      failCount++
      failedRepos.push(repoLabel)
      results.push(`[${repoLabel}]: 合并失败 — ${errMsg}`)
      // Abort merge if conflict so working tree is clean for coder to retry
      await runShell(
        runtime_name,
        `git -C "${repoPath}" merge --abort 2>/dev/null || true; git -C "${repoPath}" checkout ${defaultBranch} 2>/dev/null; git -C "${repoPath}" reset --hard HEAD; git -C "${repoPath}" clean -fdx; git -C "${repoPath}" branch -D ${branchName} 2>/dev/null || true`,
        repoPath,
        tenantId,
        userId
      ).catch(() => {})
    }
  }

  const allFailed = failCount > 0 && succeededRepos.length === 0
  if (!allFailed) {
    clawDb.updateAgentAudit(audit_id, { status: 'approved' })
  }
  return {
    success: failCount === 0,
    output: results.join('\n'),
    meta: {
      auditId: audit_id,
      branchName,
      succeededRepos,
      failedRepos,
      diffStat,
    },
  }
}

// ─── audit_codespace_change ───────────────────────────────────────────────────

export const auditCodespaceChangeDefinition: ToolDefinition = {
  name: 'audit_codespace_change',
  description:
    'Restore the stored diff patch back into the working directory so the coder can iterate on the rejected changes. ' +
    'Call this when the user rejects the audit with modification requests. ' +
    'Marks the audit as rejected and re-applies the diff as a working-tree baseline. ' +
    'Fails if the audit has already been processed (not pending).',
  parameters: {
    type: 'object',
    properties: {
      audit_id: {
        type: 'number',
        description: 'Audit ID returned by audit_codespace_submit.',
      },
      codespace: {
        type: 'string',
        description:
          'Absolute path to the git repository (the working directory).',
      },
      runtime_name: {
        type: 'string',
        description: 'Runtime name where the codespace lives (e.g. "local").',
      },
    },
    required: ['audit_id', 'codespace', 'runtime_name'],
  },
}

export async function auditCodespaceChangeTool(
  args: { audit_id: number; codespace: string; runtime_name: string },
  context: ToolContext
): Promise<ToolResult> {
  const { audit_id, codespace, runtime_name } = args
  const { agentContext } = context
  const { userId, tenantId } = agentContext

  const audit = clawDb.findAgentAuditByIdAndUser(audit_id, userId)
  if (!audit) {
    return {
      success: false,
      output: `Audit #${audit_id} not found or access denied.`,
    }
  }
  if (audit.status !== 'pending') {
    return {
      success: false,
      output: `Audit #${audit_id} has already been processed (status: ${audit.status}).`,
    }
  }

  const content: { diffs: Record<string, string | null> } =
    typeof audit.content === 'string'
      ? JSON.parse(audit.content)
      : audit.content
  const diffs = content.diffs ?? {}

  if (Object.keys(diffs).length === 0) {
    clawDb.updateAgentAudit(audit_id, { status: 'rejected' })
    return {
      success: true,
      output: 'No changes to restore. Audit marked rejected.',
    }
  }

  const applyResults = await applyAuditDiff(
    diffs,
    codespace,
    runtime_name,
    tenantId,
    userId
  )
  clawDb.updateAgentAudit(audit_id, { status: 'rejected' })

  return {
    success: true,
    output: [
      `Audit #${audit_id} marked rejected. Diff restored to working directory — coder can now iterate.`,
      ...applyResults,
    ].join('\n'),
    meta: { auditId: audit_id },
  }
}

// ─── audit_codespace_cancel ───────────────────────────────────────────────────

export const auditCodespaceCancelDefinition: ToolDefinition = {
  name: 'audit_codespace_cancel',
  description:
    'Cancel the audit and terminate the entire workflow. ' +
    'Use when the user wants to abandon the current changes entirely. ' +
    'Fails if the audit has already been processed (not pending).',
  parameters: {
    type: 'object',
    properties: {
      audit_id: {
        type: 'number',
        description: 'Audit ID returned by audit_codespace_submit.',
      },
    },
    required: ['audit_id'],
  },
}

export async function auditCodespaceCancelTool(
  args: { audit_id: number },
  context: ToolContext
): Promise<ToolResult> {
  const { audit_id } = args
  const { agentContext } = context
  const { userId } = agentContext

  const audit = clawDb.findAgentAuditByIdAndUser(audit_id, userId)
  if (!audit) {
    return {
      success: false,
      output: `Audit #${audit_id} not found or access denied.`,
    }
  }
  if (audit.status !== 'pending') {
    return {
      success: false,
      output: `Audit #${audit_id} has already been processed (status: ${audit.status}).`,
    }
  }

  clawDb.updateAgentAudit(audit_id, { status: 'cancelled' })

  if (audit.task_id) {
    try {
      clawDb.updateTaskStatus(
        audit.task_id,
        'error',
        'Workflow cancelled by user'
      )
      void clawEventBus.emit('task:updated', {
        taskId: audit.task_id,
        status: 'error',
      })
      logger.info(
        { audit_id, taskId: audit.task_id },
        'audit_codespace_cancel: task cancelled'
      )
    } catch (err) {
      logger.warn(
        { err, audit_id },
        'audit_codespace_cancel: failed to cancel task'
      )
    }
  }

  return {
    success: true,
    output: `Audit #${audit_id} cancelled. Workflow terminated.`,
    meta: { auditId: audit_id },
  }
}
