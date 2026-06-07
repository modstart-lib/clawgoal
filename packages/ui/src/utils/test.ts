/**
 * window.__test — UI 自动化测试辅助工具
 *
 * 核心思路：action 注册时机即页面就绪时机。
 * 测试侧通过 callAction 等待 action 被注册，无需额外的 ready 状态。
 *
 * 用法（页面组件 setup 中，无需 #if DEV 包裹）：
 *   import { testActionSet, testActionUnset } from '@/utils/test'
 *   import { onMounted, onUnmounted } from 'vue'
 *
 *   onMounted(() => {
 *     testActionSet('list.refresh', () => loadData())
 *     testActionSet('list.add', () => { showAddModal.value = true })
 *   })
 *   onUnmounted(() => {
 *     testActionUnset('list.refresh')
 *     testActionUnset('list.add')
 *   })
 *
 * prod 构建时函数体内的 #if DEV 块被移除，函数变为空操作，零开销。
 */

export type TestAction = (arg?: any) => Promise<void> | void

export interface TestRegistry {
  setAction(name: string, fn: TestAction): void
  unsetAction(name: string): void
  callAction(name: string, arg?: any): Promise<void>
  listActions(): string[]
  navigateTo(path: string): Promise<void>
}


/**
 * 设置一个 test action。在 onMounted 中调用。
 * action 设置时机即页面就绪时机——测试侧 callAction 会等待 action 出现。
 * prod 构建时函数体为空，零开销。
 */
export function testActionSet(name: string, fn: TestAction): void {
}

/**
 * 移除一个 test action。在 onUnmounted 中调用。
 * prod 构建时函数体为空，零开销。
 */
export function testActionUnset(name: string): void {
}

/**
 * 注册 Vue Router 导航函数，在 main.ts 中调用。
 * prod 构建时函数体为空。
 */
export function registerNavigate(fn: (path: string) => Promise<void>): void {
}

/**
 * 挂载 window.__test，在 main.ts 中调用。
 * prod 构建时函数体为空。
 * 同时在 dev 模式下拦截 ant-design-vue message.warning/error，
 * 将校验失败信息同步输出到 console.error，使 Playwright 测试可感知。
 */
export function initTestRegistry(): void {
}

