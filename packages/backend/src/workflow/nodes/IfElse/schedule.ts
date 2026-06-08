import {
  NodeRunController,
  NodeRunParam,
  NodeRunResult,
  WorkflowExecuteContext,
  WorkflowNode,
  WorkflowSchedule,
} from '../../type.js'
import { resolveVariables } from '../../variable.js'
import { wt, wtl } from '../../i18n.js'

interface IfElseCondition {
  id: string
  label: string
  type: 'simple' | 'code'
  value1?: string
  operator?: string
  value2?: string
  ignoreCase?: boolean
  code?: string
}

async function evalCondition(
  cond: IfElseCondition,
  variables: Record<string, any>,
  lang?: 'zh-CN' | 'en-US'
): Promise<boolean> {
  if (cond.type === 'simple') {
    const { value1, operator, value2, ignoreCase } = cond
    const rv1 = resolveVariables(value1, variables, '')
    const rv2 = resolveVariables(value2, variables, '')
    let s1 = String(rv1)
    let s2 = String(rv2)
    if (ignoreCase) {
      s1 = s1.toLowerCase()
      s2 = s2.toLowerCase()
    }
    switch (operator) {
      case '==':
        return rv1 == rv2
      case '===':
        return rv1 === rv2
      case '!=':
        return rv1 != rv2
      case '!==':
        return rv1 !== rv2
      case '>':
        return rv1 > rv2
      case '<':
        return rv1 < rv2
      case '>=':
        return rv1 >= rv2
      case '<=':
        return rv1 <= rv2
      case 'contains':
        return s1.includes(s2)
      case 'not_contains':
        return !s1.includes(s2)
      case 'starts_with':
        return s1.startsWith(s2)
      case 'ends_with':
        return s1.endsWith(s2)
      default:
        throw new Error(wtl(lang, 'WfOperatorNotSupported', operator))
    }
  } else {
    const { code } = cond
    const resolvedCode = resolveVariables(code, variables, code)
    if (!resolvedCode) throw new Error(wtl(lang, 'WfCodeNotConfiguredCheck'))
    const trimmed = String(resolvedCode).trim()
    let output: any
    if (
      trimmed.startsWith('function') ||
      trimmed.startsWith('async function')
    ) {
      const fn = new Function('input', `return (${trimmed})(input);`)
      output = fn({})
    } else {
      const fn = new Function('input', resolvedCode as string)
      output = fn({})
    }
    return !!(output instanceof Promise ? await output : output)
  }
}

/** 将旧格式 (type/value1/operator...) 转换为新格式 conditions[] */
function normalizeData(data: any, lang?: 'zh-CN' | 'en-US'): IfElseCondition[] {
  if (
    data?.conditions &&
    Array.isArray(data.conditions) &&
    data.conditions.length > 0
  ) {
    return data.conditions as IfElseCondition[]
  }
  // 旧格式兼容
  if (data?.type) {
    return [
      {
        id: 'cond_default',
        label: wtl(lang, 'WfConditionDefault'),
        type: data.type,
        value1: data.value1,
        operator: data.operator,
        value2: data.value2,
        ignoreCase: data.ignoreCase,
        code: data.code,
      },
    ]
  }
  return []
}

export default {
  async run(
    _controller: NodeRunController,
    param: NodeRunParam,
    ctx: WorkflowExecuteContext
  ): Promise<NodeRunResult> {
    const result: NodeRunResult = {
      status: 'error',
      statusMsg: wt(ctx, 'WfUnknownError'),
      runOutputs: {},
      runData: {},
    }
    const data = param.node.properties.data || {}
    const conditions = normalizeData(data, ctx.lang)
    if (conditions.length === 0) {
      result.statusMsg = wt(ctx, 'WfConditionNotConfigured')
      return result
    }
    result.runData!['Next'] = 'else'
    try {
      for (const cond of conditions) {
        const matched = await evalCondition(cond, param.variables, ctx.lang)
        if (matched) {
          result.runData!['Next'] = cond.id
          break
        }
      }
      result.status = 'success'
      result.statusMsg = wt(ctx, 'WfExecuteSuccess')
    } catch (e) {
      result.statusMsg = wt(ctx, 'WfExecuteError') + ': ' + (e as Error).message
    }
    return result
  },
  async check(node: WorkflowNode, lang?: 'zh-CN' | 'en-US') {
    const data = node.properties.data || {}
    const conditions = normalizeData(data, lang)
    if (conditions.length === 0)
      throw new Error(wtl(lang, 'WfConditionNotConfigured'))
    for (const cond of conditions) {
      if (cond.type === 'simple') {
        if (
          cond.value1 === undefined ||
          !cond.operator ||
          cond.value2 === undefined
        )
          throw new Error(wtl(lang, 'WfConditionIncomplete', cond.label))
      } else if (cond.type === 'code') {
        if (!cond.code)
          throw new Error(wtl(lang, 'WfConditionCodeNotConfigured', cond.label))
      }
    }
  },
} satisfies WorkflowSchedule
