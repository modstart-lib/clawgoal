import {
  NodeRunController,
  NodeRunParam,
  NodeRunResult,
  WorkflowExecuteContext,
  WorkflowNode,
  WorkflowSchedule,
} from '../../type.js'
import { runInBrowser, BrowserRunOptions } from '../../browserRunner.js'
import { wt, wtl } from '../../i18n.js'

/**
 * FunctionCall 节点——后端执行器
 *
 * FunctionCall 节点的实际业务逻辑由各模块在运行时注册到 functionCallSchedules。
 * 如果找不到注册的调度器，则返回错误。
 *
 * 如果调度器声明了 browserRun，则节点将在 Playwright Chromium 页面中执行，
 * 允许使用 WebCodecs、Canvas 等浏览器 API。
 */

export type FunctionCallSchedule = {
  run(
    controller: NodeRunController,
    param: NodeRunParam
  ): Promise<NodeRunResult>
  check?(node: WorkflowNode): Promise<void>
  /**
   * 如果需要在浏览器中执行（例如使用 WebAV、WebCodecs 等 API），
   * 提供此字段替代 run()。
   *
   * 函数将在 Playwright Chromium 上下文中执行（不能引用外部闭包变量）。
   * 浏览器全局可用：
   *   - __lfReadFile(path): Promise<string>  → 读取服务器文件为 base64
   *   - __lfWriteFile(path, base64): Promise<void> → 写 base64 到服务器文件
   *   - __lfMkdir(path): Promise<void>       → 创建目录
   *   - __lfTempPath(ext): Promise<string>   → 生成临时文件路径
   */
  browserRun?: {
    fn: (inputs: Record<string, any>) => Promise<Record<string, any>>
    opts?: BrowserRunOptions
  }
}

const _registry = new Map<string, FunctionCallSchedule>()

export function registerFunctionCallSchedule(
  name: string,
  schedule: FunctionCallSchedule
) {
  _registry.set(name, schedule)
}

export default {
  async run(
    controller: NodeRunController,
    param: NodeRunParam,
    ctx: WorkflowExecuteContext
  ): Promise<NodeRunResult> {
    const name = param.node.properties.data?.functionCallName
    if (!name) {
      return {
        status: 'error',
        statusMsg: wt(ctx, 'WfFuncNotConfigured'),
        runOutputs: {},
      }
    }
    const schedule = _registry.get(name)
    if (!schedule) {
      return {
        status: 'error',
        statusMsg: wt(ctx, 'WfFuncNotRegistered'),
        runOutputs: {},
      }
    }
    // 如果声明了 browserRun，在 Playwright 浏览器中执行
    if (schedule.browserRun) {
      try {
        const runOutputs = await runInBrowser(
          schedule.browserRun.fn,
          param.runInputs,
          schedule.browserRun.opts
        )
        return {
          status: 'success',
          statusMsg: '',
          runOutputs: runOutputs ?? {},
        }
      } catch (e: any) {
        return {
          status: 'error',
          statusMsg:
            wt(ctx, 'WfBrowserFailed') + ': ' + (e?.message || String(e)),
          runOutputs: {},
        }
      }
    }
    return schedule.run(controller, param)
  },
  async check(node: WorkflowNode, lang?: 'zh-CN' | 'en-US') {
    const name = node.properties.data?.functionCallName
    if (!name) throw new Error(wtl(lang, 'WfFuncNameNotConfigured'))
    const schedule = _registry.get(name)
    if (schedule?.check) {
      await schedule.check(node)
    }
  },
} satisfies WorkflowSchedule
