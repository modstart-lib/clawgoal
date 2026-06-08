/**
 * Asks 节点交互事件总线
 * 使用栈结构，顶层处理器（最后注册的）响应事件，实现弹窗层叠时正确的事件归属。
 */
const _stack: (() => void)[] = []

/** 派发 Asks 动作，由栈顶处理器响应 */
export function dispatchAsksAction() {
  const top = _stack[_stack.length - 1]
  top?.()
}

/**
 * 注册 Asks 动作处理器，后注册的优先响应。
 * @returns 取消注册函数
 */
export function pushAsksHandler(handler: () => void): () => void {
  _stack.push(handler)
  return () => {
    const i = _stack.lastIndexOf(handler)
    if (i !== -1) _stack.splice(i, 1)
  }
}
