/**
 * Programer role — WorkflowFactory for `coder` and `merger` pipelines.
 *
 * Flow:
 *   coder pipeline:  resolver_check → resolver (loop) → coder → post_coder
 *   merger pipeline: review_router → merger | restorer | canceller
 *
 * GitSpace structure:
 *   gitspace/          ← 普通目录（无 .git），由 clawgoal.json 描述
 *   gitspace/backend/  ← 独立 git 仓库
 *   gitspace/frontend/ ← 独立 git 仓库
 *   gitspace/clawgoal.json ← 仓库配置（programerPrepare 自动生成/补全）
 *
 * Branch strategy:
 *   coder     → 调用 LLM 生成 feature 名，切出统一分支 agent/programer_{YYYYMMDDHHMMSS}_{feature}（所有子仓库同名）
 *   post_coder → git diff mainBranch...devBranch 生成 audit diffs，切回主分支（保留开发分支）
 *   merger    → git merge --squash devBranch 合并到主分支，只推主分支到远程，开发分支仅本地保留
 *   restorer  → 切回开发分支，让 runner 继续修改（跳过重新切分支）
 *   canceller → 切回主分支，保留开发分支
 */

import type { WorkflowFactory } from '../../../kernel/dynamicCode.js'
import { existsSync, readFileSync } from 'node:fs'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import path from 'node:path'
import { clawDb } from '../../../storage/store/index.js'
import { clawEventBus } from '../../../kernel/eventBus.js'
import { getClawRuntimeWs } from '../../../index.js'
import {
  type GitSpaceConfig,
  type ShellRunner,
  readOrCreateGitSpaceConfig,
  generateFeatureName,
  buildBranchName,
  forceCheckoutBranch,
  createDevBranch,
  collectBranchDiff,
  squashMergeBranch,
} from '../../../../../backend/src/utils/git.js'

const execFileAsync = promisify(execFile)

// ─── runtime shell ─────────────────────────────────────────────────────────────

function makeShellRunner(
  runtimeName: string,
  tenantId: number,
  userId: number
): ShellRunner {
  return async (command: string, cwd: string) => {
    if (runtimeName === 'local') {
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
}

// ─── programerPrepare ─────────────────────────────────────────────────────────

/**
 * coder / merger 前的统一准备函数：
 * 1. 读取或生成 clawgoal.json，验证所有仓库有效
 * 2. 将所有子仓库强制切回各自的 mainBranch 最新状态
 */
async function programerPrepare(
  gitspace: string,
  run: ShellRunner
): Promise<GitSpaceConfig> {
  const configPath = path.join(gitspace, 'clawgoal.json')
  const config = await readOrCreateGitSpaceConfig(gitspace, configPath)

  for (const repo of config.repos) {
    const repoPath = path.join(gitspace, repo.name)
    await forceCheckoutBranch(repoPath, repo.mainBranch, run)
  }

  return config
}

// ─── coder pipeline ───────────────────────────────────────────────────────────

export const coder: WorkflowFactory = (clawgoal) => ({
  async onEnter() {},
  async onExit() {},
  nodes: {
    resolver_check: async () => {
      const resolved = clawgoal.getContext('studioResolved') as
        | string
        | undefined
      if (!clawgoal.getContext('gitRepos')) {
        const param = clawgoal.agent.param as Record<string, string>
        let gitspace = param?.codespace ?? ''
        if (!gitspace && resolved) {
          for (const part of resolved.split(' ')) {
            if (part.startsWith('codespace=')) {
              gitspace = part.slice('codespace='.length)
              break
            }
          }
        }
        if (gitspace) {
          const runtimeName = param?.runtime ?? 'local'
          const { userId, tenantId } = clawgoal.agentContext
          const run = makeShellRunner(runtimeName, tenantId, userId)

          let gsConfig: GitSpaceConfig
          try {
            gsConfig = await programerPrepare(gitspace, run)
          } catch (err) {
            throw new Error(String(err))
          }

          const repoPaths: string[] = []
          const repoLines: string[] = []
          for (const repo of gsConfig.repos) {
            const p = path.join(gitspace, repo.name)
            repoLines.push(`- ${repo.name}: ${p}`)
            repoPaths.push(p)
          }

          clawgoal.setContext('gitRepos', repoLines.join('\n'))
          clawgoal.setContext('gitSpaceConfig', gsConfig)

          try {
            const readmeParts: string[] = []
            const rootReadme = path.join(gitspace, 'README.md')
            if (existsSync(rootReadme)) {
              let c = readFileSync(rootReadme, 'utf-8')
              if (c.length > 3000) c = c.slice(0, 3000) + '\n...(截断)'
              readmeParts.push(`## (gitspace root)\n${c}`)
            }
            for (const rp of repoPaths) {
              const readmePath = path.join(rp, 'README.md')
              if (existsSync(readmePath)) {
                let c = readFileSync(readmePath, 'utf-8')
                if (c.length > 1000) c = c.slice(0, 1000) + '\n...(截断)'
                readmeParts.push(`## ${path.basename(rp)}\n${c}`)
              }
            }
            if (readmeParts.length > 0) {
              let c = readmeParts.join('\n\n')
              if (c.length > 5000) c = c.slice(0, 5000) + '\n\n...(截断)'
              clawgoal.setContext('readmeContent', c)
            }
          } catch {
            /* non-critical */
          }
        }
      }
      if (!resolved) {
        const param = clawgoal.agent.param as Record<string, string>
        const codespace = param?.codespace ?? ''
        const runtime = param?.runtime ?? 'local'
        const runner = param?.runner ?? 'opencode'
        if (runtime === 'local' && codespace) {
          clawgoal.setContext(
            'studioResolved',
            `codespace=${codespace} runtime=${runtime} runner=${runner}`
          )
          clawgoal.routeTo('coder')
          return
        }
      }
      clawgoal.routeTo(resolved ? 'coder' : 'resolver')
    },

    coder: async () => {
      const studioResolved = clawgoal.getContext('studioResolved') as
        | string
        | undefined
      const param = clawgoal.agent.param as Record<string, string>
      let gitspace = param?.codespace ?? ''
      let runtimeName = param?.runtime ?? 'local'
      let runnerName = param?.runner ?? 'opencode'
      if (studioResolved) {
        const cwdMatch = studioResolved.match(/codespace=(\S+)/)
        if (cwdMatch) gitspace = cwdMatch[1]!
        const runtimeMatch = studioResolved.match(/runtime=(\S+)/)
        if (runtimeMatch) runtimeName = runtimeMatch[1]!
        const runnerMatch = studioResolved.match(/runner=(\S+)/)
        if (runnerMatch) runnerName = runnerMatch[1]!
      }
      const { userId, tenantId } = clawgoal.agentContext
      const run = makeShellRunner(runtimeName, tenantId, userId)

      let taskText = ''
      for (let i = clawgoal.messages.length - 1; i >= 0; i--) {
        const msg = clawgoal.messages[i]
        if (msg && msg._getType() === 'human') {
          const c = typeof msg.content === 'string' ? msg.content : ''
          if (!c.startsWith('⚠️')) {
            taskText = c
            break
          }
        }
      }

      // 切出开发分支（runner 将在此分支上写代码并 commit）
      // 若 restorer 已切回旧开发分支，跳过重新切分支，直接在旧分支上继续
      const gsConfig = clawgoal.getContext('gitSpaceConfig') as
        | GitSpaceConfig
        | undefined
      const restoredDevBranch = clawgoal.getContext('restoredDevBranch') as
        | string
        | undefined
      if (!restoredDevBranch && gsConfig && gsConfig.repos.length > 0) {
        try {
          // programerPrepare 恢复各仓库到 main 状态
          await programerPrepare(gitspace, run)
          const feature = await generateFeatureName(taskText, tenantId, userId)
          const devBranch = buildBranchName('programer', feature)
          console.log(`[programer/coder] 🏷️ 分支名: ${devBranch}`)
          for (const repo of gsConfig.repos) {
            await createDevBranch(
              path.join(gitspace, repo.name),
              devBranch,
              run
            )
          }
          clawgoal.setContext('devBranch', devBranch)
        } catch (err) {
          console.error('[programer/coder] 切出开发分支失败:', err)
        }
      }
      clawgoal.setContext('restoredDevBranch', undefined)

      // 冲突修复场景：切回开发分支，然后 merge main，让 git 标记冲突文件
      // runner 看到冲突标记后直接解决，避免 squash merge 时再次冲突
      const coderRetryHint = clawgoal.getContext('coderRetryHint') as
        | string
        | undefined
      const currentDevBranch = clawgoal.getContext('devBranch') as
        | string
        | undefined
      if (coderRetryHint && gsConfig && currentDevBranch) {
        for (const repo of gsConfig.repos) {
          const repoPath = path.join(gitspace, repo.name)
          // 切回开发分支（squashMergeBranch 执行后仓库在 main 上）
          const checkoutOut = await run(
            `git -C "${repoPath}" checkout -f ${currentDevBranch} 2>&1 || true`,
            repoPath
          )
          console.log(
            `[programer/coder] checkout devBranch (${repo.name}): ${checkoutOut.slice(0, 100)}`
          )
          // merge main，让 git 标记冲突文件
          const mergeOut = await run(
            `git -C "${repoPath}" merge ${repo.mainBranch} 2>&1 || true`,
            repoPath
          )
          console.log(
            `[programer/coder] merge main into devBranch (${repo.name}): ${mergeOut.slice(0, 200)}`
          )
        }
      }

      const readmeContent = clawgoal.getContext('readmeContent') as
        | string
        | undefined
      const promptParts: string[] = []
      if (coderRetryHint) promptParts.push(coderRetryHint)
      if (readmeContent) promptParts.push(readmeContent)
      if (taskText) promptParts.push(taskText)

      await clawgoal.executeTool('runtime_execute', {
        cwd: gitspace,
        prompt: promptParts.join('\n\n'),
        runtime_name: runtimeName,
        runner_name: runnerName,
      })
      clawgoal.routeTo('post_coder')
    },

    post_coder: async () => {
      const studioResolved = clawgoal.getContext('studioResolved') as
        | string
        | undefined
      const param = clawgoal.agent.param as Record<string, string>
      let gitspace = param?.codespace ?? ''
      let runtimeName = param?.runtime ?? 'local'
      if (studioResolved) {
        const cwdMatch = studioResolved.match(/codespace=(\S+)/)
        if (cwdMatch) gitspace = cwdMatch[1]!
        const runtimeMatch = studioResolved.match(/runtime=(\S+)/)
        if (runtimeMatch) runtimeName = runtimeMatch[1]!
      }
      const { userId, tenantId } = clawgoal.agentContext
      const run = makeShellRunner(runtimeName, tenantId, userId)

      const gsConfig = clawgoal.getContext('gitSpaceConfig') as
        | GitSpaceConfig
        | undefined
      const devBranch = clawgoal.getContext('devBranch') as string | undefined

      if (!devBranch || !gsConfig) {
        await clawgoal.askUser(
          '✅ 任务已完成，未检测到代码变更（工作区无 git diff）。\n\n如需继续修改，请描述新的需求。',
          { question: '如需继续修改，请告知需求。', options: ['完成'] }
        )
        return
      }

      // 对比开发分支和主分支，生成 audit diffs
      const diffs: Record<string, string> = {}
      for (const repo of gsConfig.repos) {
        const repoPath = path.join(gitspace, repo.name)
        const diff = await collectBranchDiff(
          repoPath,
          repo.mainBranch,
          devBranch,
          run
        )
        if (diff) diffs[repo.name] = diff
      }

      if (Object.keys(diffs).length === 0) {
        // 无变更：切回主分支
        for (const repo of gsConfig.repos) {
          await forceCheckoutBranch(
            path.join(gitspace, repo.name),
            repo.mainBranch,
            run
          )
        }
        clawgoal.setContext('devBranch', undefined)
        await clawgoal.askUser(
          '✅ 任务已完成，未检测到代码变更（开发分支与主分支无差异）。\n\n如需继续修改，请描述新的需求。',
          { question: '如需继续修改，请告知需求。', options: ['完成'] }
        )
        return
      }

      // 切回主分支（保留开发分支供 merger 使用）
      for (const repo of gsConfig.repos) {
        await forceCheckoutBranch(
          path.join(gitspace, repo.name),
          repo.mainBranch,
          run
        )
      }

      const totalChangedLines = Object.values(diffs).reduce(
        (sum, d) =>
          sum +
          d.split('\n').filter((l) => l.startsWith('+') || l.startsWith('-'))
            .length,
        0
      )
      const diffStat = `${totalChangedLines} lines changed`

      const { agentId, sessionId = 0, taskId } = clawgoal.agentContext
      const auditRow = clawDb.insertAgentAudit({
        tenantId,
        userId,
        agentId,
        taskId: taskId ?? undefined,
        sessionId,
        content: {
          diffs,
          diffStat,
          devBranch,
          summary: `programer: ${Object.keys(diffs).join(', ')}`,
        },
      })
      const auditId = auditRow.id

      clawgoal.setContext('coderRetryHint', undefined)
      clawgoal.setContext('auditId', auditId)

      const reviewMsg = [
        '代码变更已提交审核。',
        `审核编号：Audit #${auditId}`,
        `开发分支：\`${devBranch}\``,
        '',
        '请选择：',
        '- **批准** → 变更将被合并到主分支',
        '- **拒绝**（附修改说明）→ 变更恢复到工作区继续修改',
        '- **取消** → 放弃此次变更',
      ].join('\n')

      clawgoal.setContext('nextPipeline', 'merger')
      await clawgoal.askUser(reviewMsg, {
        question: '请审核代码变更，批准则合并，拒绝可附说明后修改。',
        options: ['批准', '取消'],
        actionView: { label: '查看代码变更', data: { auditId } },
      })
    },
  },
})

// ─── merger pipeline ──────────────────────────────────────────────────────────

export const merger: WorkflowFactory = (clawgoal) => ({
  async onEnter() {},
  async onExit() {},
  nodes: {
    merger: async () => {
      const auditId = clawgoal.getContext('auditId') as number | undefined
      if (!auditId) return
      const param = clawgoal.agent.param as Record<string, string>
      const gitspace = param?.codespace ?? ''
      const runtimeName =
        (clawgoal.getContext('runtime') as string | undefined) ??
        param?.runtime ??
        'local'
      const { userId, tenantId } = clawgoal.agentContext
      const run = makeShellRunner(runtimeName, tenantId, userId)

      const gsConfig = clawgoal.getContext('gitSpaceConfig') as
        | GitSpaceConfig
        | undefined
      const devBranch = clawgoal.getContext('devBranch') as string | undefined

      // 预检：恢复各仓库到 main 状态，验证 clawgoal.json
      try {
        await programerPrepare(gitspace, run)
      } catch (err) {
        throw new Error(`merger 预检失败：${String(err)}`)
      }

      if (!devBranch || !gsConfig) {
        throw new Error('merger 失败：找不到开发分支信息（devBranch 为空）')
      }

      const audit = clawDb.findAgentAuditById(auditId)
      if (!audit) throw new Error(`Audit #${auditId} not found.`)
      const content: {
        diffs: Record<string, string | null>
        summary?: string
        diffStat?: string
      } =
        typeof audit.content === 'string'
          ? JSON.parse(audit.content)
          : audit.content
      const summary = content.summary ?? 'apply changes'
      const diffStat = content.diffStat ?? ''

      const reposWithDiff = gsConfig.repos.filter((r) =>
        content.diffs?.[r.name]?.trim()
      )
      if (reposWithDiff.length === 0) {
        clawDb.updateAgentAudit(auditId, { status: 'approved' })
        clawgoal.setContext('auditId', undefined)
        clawgoal.setContext('devBranch', undefined)
        clawgoal.setOutput(
          '✅ 无变更需要合并。\n\n如需继续开发，请告诉我新的需求。'
        )
        return
      }

      const succeededRepos: string[] = []
      const failedResults: string[] = []
      let isConflict = false

      for (const repo of reposWithDiff) {
        const repoPath = path.join(gitspace, repo.name)
        const res = await squashMergeBranch(
          repoPath,
          repo.mainBranch,
          devBranch,
          `feat: ${summary.replace(/"/g, "'")}`,
          run
        )
        if (res.success) {
          succeededRepos.push(repo.name)
          console.log(`[programer/merger] ✅ ${repo.name}: ${res.output}`)
        } else {
          failedResults.push(`[${repo.name}]: ${res.output}`)
          if (res.isConflict) isConflict = true
        }
      }

      clawgoal.setContext('auditId', undefined)
      // 冲突时保留 devBranch，让 coder 在原分支上继续修复
      // clawgoal.setContext('devBranch', undefined)  ← 不清除

      if (failedResults.length > 0 && isConflict) {
        clawgoal.setContext(
          'coderRetryHint',
          [
            '⚠️ 合并时发生代码冲突，需要切回开发分支修复冲突后重新提交。',
            `冲突详情：\n${failedResults.join('\n')}`,
            '请执行以下步骤：',
            '1. 在开发分支上执行 git merge <mainBranch>，将主分支变更合并进来',
            '2. 解决冲突文件（保留正确内容）',
            '3. git add 冲突文件，然后 git commit 完成合并',
          ].join('\n')
        )
        clawgoal.setContext('restoredDevBranch', devBranch)
        clawgoal.setContext('nextPipeline', 'coder')
        await clawgoal.askUser(
          `⚠️ 合并时发生代码冲突，需要重新调整代码。冲突详情：\n\n${failedResults.join('\n')}`,
          {
            question: '是否让 AI 重新修复冲突后提交？',
            options: ['重新修复', '放弃'],
          }
        )
      } else if (failedResults.length > 0) {
        // 非冲突失败：清除 devBranch，抛出错误
        clawgoal.setContext('devBranch', undefined)
        throw new Error(
          `merger 合并失败（audit #${auditId}）：${failedResults.join('\n')}`
        )
      } else {
        // 合并成功：清除 devBranch
        clawgoal.setContext('devBranch', undefined)
        clawDb.updateAgentAudit(auditId, { status: 'approved' })
        const repoList = succeededRepos.join('、')
        const statHint = diffStat ? `\n\n变更摘要：${diffStat.trim()}` : ''
        const branchHint = devBranch ? `\n分支：\`${devBranch}\`` : ''
        clawgoal.setOutput(
          `✅ 代码已成功合并到主分支（${repoList}）。${branchHint}${statHint}\n\n如需继续开发，请告诉我新的需求。`
        )
      }
    },

    restorer: async () => {
      const auditId = clawgoal.getContext('auditId') as number | undefined
      if (!auditId) return
      const param = clawgoal.agent.param as Record<string, string>
      const gitspace = param?.codespace ?? ''
      const runtimeName =
        (clawgoal.getContext('runtime') as string | undefined) ??
        param?.runtime ??
        'local'
      const { userId, tenantId } = clawgoal.agentContext
      const run = makeShellRunner(runtimeName, tenantId, userId)

      const lastUserMsg = [...clawgoal.messages]
        .reverse()
        .find((m) => m._getType() === 'human')
      const rejectionReason =
        typeof lastUserMsg?.content === 'string' ? lastUserMsg.content : ''

      clawDb.updateAgentAudit(auditId, { status: 'rejected' })
      clawgoal.setContext('auditId', undefined)

      // 切回开发分支，让 runner 继续在原分支上修改（保留 devBranch context）
      const devBranch = clawgoal.getContext('devBranch') as string | undefined
      const gsConfig = clawgoal.getContext('gitSpaceConfig') as
        | GitSpaceConfig
        | undefined
      if (devBranch && gsConfig) {
        for (const repo of gsConfig.repos) {
          const repoPath = path.join(gitspace, repo.name)
          await run(
            `git -C "${repoPath}" checkout ${devBranch} 2>/dev/null || true`,
            repoPath
          )
        }
        clawgoal.setContext('restoredDevBranch', devBranch)
      }

      const auditRecord = clawDb.findAgentAuditById(auditId)
      const auditContent = auditRecord?.content as
        | { diffs?: Record<string, string | null> }
        | undefined
      const changedFiles: string[] = []
      if (auditContent?.diffs) {
        for (const [repo, diff] of Object.entries(auditContent.diffs)) {
          if (!diff) continue
          diff
            .split('\n')
            .filter((l) => l.startsWith('+++ b/'))
            .forEach((l) => changedFiles.push(`${repo}/${l.slice(6)}`))
        }
      }

      clawgoal.setContext(
        'coderRetryHint',
        [
          '⚠️ 上次代码审核被拒绝，已切回开发分支，请继续修改。',
          `拒绝原因：${rejectionReason}`,
          changedFiles.length > 0
            ? `需要修改的文件：${changedFiles.join(', ')}`
            : '',
          '请根据审核意见修改后重新提交。',
        ]
          .filter(Boolean)
          .join('\n')
      )
      clawgoal.setContext('nextPipeline', 'coder')
      clawgoal.setContext('autoResumeNextPipeline', true)

      const fileHint =
        changedFiles.length > 0
          ? `（${changedFiles.map((f) => f.split('/').pop()).join('、')}）`
          : ''
      clawgoal.setOutput(
        `审核已拒绝，已切回开发分支${fileHint}。根据您的修改意见，我将立即重新优化代码。`
      )
    },

    canceller: async () => {
      const auditId = clawgoal.getContext('auditId') as number | undefined
      if (!auditId) return
      const { userId } = clawgoal.agentContext

      const audit = clawDb.findAgentAuditByIdAndUser(auditId, userId)
      if (audit?.status === 'pending') {
        clawDb.updateAgentAudit(auditId, { status: 'cancelled' })
        if (audit.task_id) {
          try {
            clawDb.updateTaskStatus(
              audit.task_id,
              'cancelled' as any,
              'Workflow cancelled by user'
            )
            void clawEventBus.emit('task:updated', {
              taskId: audit.task_id,
              status: 'cancelled',
            })
          } catch {
            /* non-critical */
          }
        }
      }

      clawgoal.setContext('auditId', undefined)
      const param = clawgoal.agent.param as Record<string, string>
      const gitspace = param?.codespace ?? ''
      const runtimeName =
        (clawgoal.getContext('runtime') as string | undefined) ??
        param?.runtime ??
        'local'
      const { tenantId } = clawgoal.agentContext
      const run = makeShellRunner(runtimeName, tenantId, userId)
      const gsConfig = clawgoal.getContext('gitSpaceConfig') as
        | GitSpaceConfig
        | undefined
      // 取消时切回主分支，保留开发分支（不删除）
      if (gsConfig) {
        for (const repo of gsConfig.repos) {
          await forceCheckoutBranch(
            path.join(gitspace, repo.name),
            repo.mainBranch,
            run
          ).catch(() => {})
        }
      }
      clawgoal.setContext('devBranch', undefined)
      clawgoal.setOutput('cancelled')
    },
  },
})
