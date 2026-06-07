import vue from '@vitejs/plugin-vue'
import path from 'node:path'

export const sharedOptimizeDeps = {
  include: ['echarts', 'vue-echarts'],
}

export const sharedManualChunks = (id: string) => {
  if (
    id.includes('node_modules/vue/') ||
    id.includes('node_modules/@vue/runtime-') ||
    id.includes('node_modules/@vue/reactivity') ||
    id.includes('node_modules/@vue/shared')
  ) {
    return 'vue-core'
  }
  if (id.includes('node_modules/vue-router/')) return 'vue-router'
  if (id.includes('node_modules/ant-design-vue/')) return 'antd-vue'
  if (id.includes('node_modules/@ant-design/')) return 'antd-icons'
  if (id.includes('node_modules/lucide-vue-next/')) return 'lucide-icons'
  if (id.includes('node_modules/dayjs/')) return 'dayjs'
  if (id.includes('node_modules/marked/')) return 'markdown'
  if (id.includes('node_modules/')) return 'vendor'
}

export const sharedPlugins = [vue()]

export function sharedAlias(pkgDir: string) {
  return [
    { find: '@/claw',  replacement: path.resolve(pkgDir, '../ui-claw/src') },
    { find: '@',       replacement: path.resolve(pkgDir, '../ui/src') },
  ]
}

export const sharedDedupe = [
  // Vue 核心
  'vue',
  'vue-router',
  'pinia',
  'vue-i18n',
  // UI 组件库
  'ant-design-vue',
  '@ant-design/icons',
  'lucide-vue-next',
  // 工具
  'dayjs',
  'axios',
  // 图表
  'echarts',
  'vue-echarts',
  // 代码编辑器
  'codemirror',
  '@codemirror/state',
  '@codemirror/view',
  '@codemirror/language',
  '@codemirror/commands',
  '@codemirror/autocomplete',
  '@codemirror/search',
  '@codemirror/lint',
  '@codemirror/lang-javascript',
  '@codemirror/lang-json',
  '@codemirror/lang-markdown',
  '@codemirror/lang-yaml',
  '@codemirror/theme-one-dark',
  // 终端
  '@xterm/xterm',
  '@xterm/addon-fit',
  '@xterm/addon-web-links',
  // Markdown
  'md-editor-v3',
  'marked',
  // 3D
  '@babylonjs/core',
  '@babylonjs/loaders',
  // 网络
  'socket.io-client',
]
