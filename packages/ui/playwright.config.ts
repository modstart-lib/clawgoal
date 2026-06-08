import { defineConfig, devices } from '@playwright/test'

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:53000'

// UI_SCOPE 控制运行哪些测试：
//   ''      → 全部（所有 ui-xxx/test，不含 ui/test）
//   'claw'  → 仅 packages/ui-claw/test
//   'write' → 仅 packages/ui-write/test
//   ... 其他模块同理
const UI_SCOPE = process.env.UI_SCOPE ?? ''

function getTestMatch(): string[] {
  if (UI_SCOPE) {
    return [`**/ui-${UI_SCOPE}/test/**/*.test.ts`]
  }
  // 默认：运行所有 ui-xxx/test（不含 ui/test，ui/test 只有 helpers）
  return ['**/ui-*/test/**/*.test.ts']
}

export default defineConfig({
  testDir: '../',
  testMatch: getTestMatch(),
  // 整个套件启动前执行一次登录，保存 storageState
  // 路径相对于 playwright.config.ts 所在目录（packages/ui/）
  globalSetup: './test/globalSetup.ts',
  globalTeardown: './test/globalTeardown.ts',
  // 每个测试最多 90s，给复杂操作留足时间
  timeout: 90_000,
  retries: 0,
  // workers: 1 确保所有测试串行，共享同一个 worker-scoped sharedPage
  workers: 1,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
  use: {
    baseURL: BASE_URL,
    headless: false,
    screenshot: 'only-on-failure',
    video: 'off',
    locale: 'zh-CN',
    // slowMo 800ms：每次操作后停顿，确保人眼可以看清每一步
    launchOptions: {
      slowMo: 800,
    },
    actionTimeout: 20_000,
    navigationTimeout: 30_000,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
})
