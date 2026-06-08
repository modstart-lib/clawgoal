import fs from 'fs'
import os from 'os'
import path from 'path'

let _browser: any = null

async function getBrowser(): Promise<any> {
  if (_browser?.isConnected?.()) return _browser
  let chromium: any
  try {
    const pw = await import('playwright')
    chromium = pw.chromium
  } catch {
    throw new Error(
      'playwright 未安装，请运行: bun add playwright && bunx playwright install chromium'
    )
  }
  _browser = await chromium.launch({ headless: true })
  return _browser
}

export interface BrowserRunOptions {
  /** 额外注入的脚本 URL 或本地路径（CDN/本地库，如 WebAV） */
  scripts?: string[]
}

/**
 * 在 Playwright Chromium 页面中执行函数。
 *
 * 浏览器页面内可调用以下全局异步函数（通过 exposeFunction 注入）：
 *   - `__lfReadFile(path: string): Promise<string>`   → 读取服务器文件，返回 base64
 *   - `__lfWriteFile(path: string, base64: string): Promise<void>` → 写 base64 到服务器文件
 *   - `__lfMkdir(path: string): Promise<void>`         → 在服务器创建目录
 *   - `__lfTempPath(ext: string): Promise<string>`     → 生成临时文件路径（服务器端）
 *
 * @param browserFn - 在浏览器中执行的 async 函数；不能引用闭包变量
 * @param inputs    - 传入浏览器函数的参数（必须 JSON 可序列化）
 * @param opts      - 可选注入脚本列表
 * @returns 浏览器函数的返回值
 */
export async function runInBrowser<T>(
  browserFn: (inputs: Record<string, any>) => Promise<T>,
  inputs: Record<string, any>,
  opts: BrowserRunOptions = {}
): Promise<T> {
  const browser = await getBrowser()
  const ctx = await browser.newContext()
  const page = await ctx.newPage()
  try {
    // 文件系统桥接——暴露到浏览器全局
    await page.exposeFunction('__lfReadFile', (filePath: string): string => {
      return fs.readFileSync(filePath).toString('base64')
    })
    await page.exposeFunction(
      '__lfWriteFile',
      (filePath: string, base64: string): void => {
        fs.mkdirSync(path.dirname(filePath), { recursive: true })
        fs.writeFileSync(filePath, Buffer.from(base64, 'base64'))
      }
    )
    await page.exposeFunction('__lfMkdir', (dirPath: string): void => {
      fs.mkdirSync(dirPath, { recursive: true })
    })
    await page.exposeFunction('__lfTempPath', (ext: string): string => {
      return path.join(
        os.tmpdir(),
        `lfbr_${Date.now()}_${Math.random().toString(36).slice(2)}${ext}`
      )
    })

    // 注入额外脚本
    for (const script of opts.scripts ?? []) {
      if (script.startsWith('http://') || script.startsWith('https://')) {
        await page.addScriptTag({ url: script })
      } else {
        await page.addScriptTag({ path: script })
      }
    }

    return (await page.evaluate(browserFn, inputs)) as T
  } finally {
    await ctx.close()
  }
}

export async function closeBrowserRunner(): Promise<void> {
  if (_browser) {
    await _browser.close().catch(() => {})
    _browser = null
  }
}
