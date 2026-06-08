import { resolveApiPath } from '../api/base'

/**
 * 开发模式下轮询 POST /api/ping，直到后端 DB 与子系统初始化完成（与后端 isServerReady 一致）。
 */
export async function waitForBackendPingInDev(): Promise<void> {
  if (!import.meta.env.DEV) return
  if (import.meta.env.VITE_SKIP_BACKEND_WAIT === '1') return
  if (localStorage.getItem('__SKIP_BACKEND_WAIT__') === '1') return

  const url = resolveApiPath('/ping')
  const deadline = Date.now() + 120_000
  while (Date.now() < deadline) {
    try {
      const r = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      })
      if (r.ok) {
        const j = (await r.json()) as { code?: number }
        if (j.code === 0) return
      }
    } catch {
      /* 代理未就绪或后端 503 */
    }
    await new Promise((res) => setTimeout(res, 5000))
  }
  console.warn(
    '[ClawGoal] 后端在 120s 内未完成初始化（/api/ping 未返回成功），页面将继续加载。'
  )
}
