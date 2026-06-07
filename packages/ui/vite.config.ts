import vue from '@vitejs/plugin-vue'
import { cpSync, existsSync } from 'node:fs'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import os from 'node:os'
import { fileURLToPath, URL } from 'node:url'
import Icons from 'unplugin-icons/vite'
import type { Plugin } from 'vite'
import { createLogger, defineConfig } from 'vite'
import { sharedDedupe } from './vite.shared'

// 构建完成后将 cube-character 静态资产复制到 dist/cube-character/
// 解决打包后 import.meta.url 指向 /assets/chunk.js 导致 assets 路径变成 /assets/assets/ 的问题
function cubeCharacterAssetsPlugin(): Plugin {
  return {
    name: 'cube-character-assets',
    closeBundle() {
      const require = createRequire(import.meta.url)
      // cube-character/package.json may not be in exports; resolve via main entry instead
      let pkgDir: string
      try {
        pkgDir = path.dirname(require.resolve('cube-character/package.json'))
      } catch {
        const mainEntry = require.resolve('cube-character')
        // walk up until we find package.json
        let dir = path.dirname(mainEntry)
        while (dir !== path.dirname(dir)) {
          if (existsSync(path.join(dir, 'package.json'))) {
            pkgDir = dir
            break
          }
          dir = path.dirname(dir)
        }
        if (!pkgDir!) return
      }
      const src = path.join(pkgDir!, 'dist/assets')
      const dest = fileURLToPath(
        new URL('./dist/cube-character', import.meta.url)
      )
      if (existsSync(src)) {
        cpSync(src, dest, { recursive: true })
      }
    },
  }
}

const pkg = JSON.parse(
  readFileSync(new URL('./package.json', import.meta.url), 'utf-8')
)

// BUILD_ID：优先用环境变量，否则自动生成
function generateBuildId(): string {
  const now = new Date()
  const y = now.getFullYear()
  const M = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  const h = String(now.getHours()).padStart(2, '0')
  const m = String(now.getMinutes()).padStart(2, '0')
  const s = String(now.getSeconds()).padStart(2, '0')
  const plat = os.platform().replace('win32', 'windows')
  const arch = os.arch().replace('x64', 'amd64')
  return `${plat}-${arch}-${y}${M}${d}-${h}${m}${s}`
}
const FRONTEND_BUILD_ID: string = process.env.BUILD_ID || generateBuildId()

const DEV_BACKEND_ORIGIN =
  process.env.VITE_DEV_BACKEND_ORIGIN ?? 'http://127.0.0.1:53001'

async function waitForBackendPingReady(): Promise<void> {
  if (process.env.VITE_SKIP_BACKEND_WAIT === '1') return
  const url = new URL('/api/ping', DEV_BACKEND_ORIGIN).href
  const deadline = Date.now() + 120_000
  process.stdout.write('等待后端就绪（POST /api/ping）...\n')
  while (Date.now() < deadline) {
    try {
      const r = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      })
      if (r.ok) {
        const j = (await r.json()) as { code?: number }
        if (j.code === 0) {
          process.stdout.write('后端已就绪。\n')
          return
        }
      }
    } catch {
      /* 连接被拒绝或后端仍在初始化（503） */
    }
    await new Promise((res) => setTimeout(res, 10000))
  }
  throw new Error('后端在 120s 内未完成初始化：POST /api/ping 未返回 code=0')
}

function waitBackendPingPlugin(): Plugin {
  return {
    name: 'wait-backend-ping',
    async configureServer() {
      await waitForBackendPingReady()
    },
  }
}

// Filter out harmless EPIPE ws proxy errors (happen when backend WS drops during dev)
const customLogger = createLogger()
const _origError = customLogger.error.bind(customLogger)
customLogger.error = (msg, options) => {
  if (typeof msg === 'string' && msg.includes('EPIPE')) return
  _origError(msg, options)
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const createManualChunks = () => (id: string) => {
    if (
      id.includes('node_modules/vue/') ||
      id.includes('node_modules/@vue/runtime-') ||
      id.includes('node_modules/@vue/reactivity') ||
      id.includes('node_modules/@vue/shared')
    ) {
      return 'vue-core'
    }
    // Vue Router
    if (id.includes('node_modules/vue-router/')) {
      return 'vue-router'
    }
    if (id.includes('node_modules/ant-design-vue/')) {
      return 'antd-vue'
    }
    if (id.includes('node_modules/@ant-design/')) {
      return 'antd-icons'
    }
    if (id.includes('node_modules/dayjs/')) {
      return 'dayjs'
    }
    if (id.includes('node_modules/marked/')) {
      return 'markdown'
    }
    if (id.includes('node_modules/')) {
      return 'vendor'
    }
  }

  const createRollupOptions = (assetDir: string, isLib = false) => ({
    output: {
      exports: 'named' as const,
      assetFileNames: (assetInfo: any) => {
        if (isLib && assetInfo.name?.endsWith('.css')) {
          return 'clawgoal.css'
        }
        if (assetInfo.name?.endsWith('.css')) {
          return `${assetDir}/clawgoal-[hash].css`
        }
        return `${assetDir}/[name]-[hash][extname]`
      },
      ...(!isLib && { entryFileNames: `${assetDir}/[name]-[hash].js` }),
      chunkFileNames: `${assetDir}/[name]-[hash].js`,
      manualChunks: createManualChunks(),
    },
  })

  const sharedBuildConfig = {
    assetsInclude: ['**/*.glb'],
    optimizeDeps: {
      exclude: [
        'echarts',
        'vue-echarts',
        'cube-character',
        '@babylonjs/core',
        '@babylonjs/loaders',
        '@babylonjs/inspector',
      ],
    },
    resolve: {
      dedupe: sharedDedupe,
      alias: [
        {
          find: '@/claw',
          replacement: fileURLToPath(
            new URL('../ui-claw/src', import.meta.url)
          ),
        },
        {
          find: '@',
          replacement: fileURLToPath(new URL('./src', import.meta.url)),
        },
      ],
    },
    define: {
      __APP_VERSION__: JSON.stringify(pkg.version),
      __BUILD_TIME__: JSON.stringify(
        new Date().toLocaleString('sv-SE').replace('T', ' ')
      ),
      __BUILD_ID__: JSON.stringify(FRONTEND_BUILD_ID),
      __HIDE_PRO__: process.env.BUILD_HIDE_PRO === 'true',
    },
    server: {
      port: 53000,
      strictPort: false,
      allowedHosts: true,
      ...(mode.startsWith('pub')
        ? {
            hmr: false,
            watch: null,
          }
        : {}),
      proxy: {
        '/api': {
          target: DEV_BACKEND_ORIGIN,
          changeOrigin: true,
          ws: true, // 启用 WebSocket 代理
          configure: (proxy) => {
            // Save Vite's default listeners, then replace with our own to suppress ECONNREFUSED logs
            const originalListeners = proxy.listeners('error').slice()
            proxy.removeAllListeners('error')
            proxy.on('error', (err: any, req: any, res: any) => {
              if (err.code === 'ECONNREFUSED') {
                // Backend not ready yet, return 503 silently (no console output)
                // res may be net.Socket (WebSocket) or http.ServerResponse (HTTP request)
                if (
                  res &&
                  typeof res.writeHead === 'function' &&
                  !res.headersSent
                ) {
                  res.writeHead(503, { 'Content-Type': 'application/json' })
                  res.end(
                    JSON.stringify({
                      code: 503,
                      msg: 'Backend not ready yet, please wait...',
                    })
                  )
                } else if (res && typeof res.destroy === 'function') {
                  // WebSocket socket — just close it silently
                  res.destroy()
                }
                return
              }
              // Delegate all other errors to Vite's original handlers
              for (const listener of originalListeners) {
                ;(listener as (...args: any[]) => void)(err, req, res)
              }
            })
          },
        },
      },
    },
  }

  if (mode === 'lib') {
    return {
      ...sharedBuildConfig,
      base: '/theme/module/ClawGoal/',
      plugins: [
        vue({
          customElement: true,
        }),
        Icons({ compiler: 'vue3', autoInstall: false }),
      ],
      build: {
        outDir: 'dist',
        emptyOutDir: false, // 不清空输出目录，保留应用构建的文件
        rollupOptions: {
          input: {
            clawgoal: fileURLToPath(
              new URL('./src/webComponent.ts', import.meta.url)
            ),
          },
          output: {
            ...createRollupOptions('assets-lib', true).output,
            entryFileNames: '[name].es.js',
          },
        },
        cssCodeSplit: false,
        chunkSizeWarningLimit: 1000,
      },
    }
  }

  return {
    ...sharedBuildConfig,
    customLogger,
    base: '/',
    plugins: [
      waitBackendPingPlugin(),
      vue(),
      Icons({ compiler: 'vue3', autoInstall: false }),
      cubeCharacterAssetsPlugin(),
    ],
    build: {
      outDir: 'dist',
      sourcemap:
        process.env.BUILD_SOURCEMAP_ENABLE === 'false' ||
        process.env.BUILD_SOURCEMAP_ENABLE === '0'
          ? false
          : 'hidden',
      rollupOptions: createRollupOptions('assets'),
      cssCodeSplit: false,
      reportCompressedSize: false,
    },
  }
})
