import type { AgentMessage } from './types'

export const getDemoMessages = (): AgentMessage[] => [
  {
    id: 'demo-1',
    role: 'user',
    content: '你好！帮我用 TypeScript 重构一下这个项目。',
    timestamp: new Date(Date.now() - 300000).toLocaleTimeString(),
  },
  {
    id: 'demo-2',
    role: 'assistant',
    content: '好的，我来帮你完成 TypeScript 重构。先读取项目结构，再逐步处理。',
    timestamp: new Date(Date.now() - 280000).toLocaleTimeString(),
  },
  // Stage — 节点生命周期
  {
    id: 'demo-stage-1',
    role: 'assistant',
    stage: { title: '代码分析', status: 'running' },
    timestamp: new Date(Date.now() - 260000).toLocaleTimeString(),
  },
  {
    id: 'demo-stage-2',
    role: 'assistant',
    stage: { title: '代码分析', status: 'success' },
    timestamp: new Date(Date.now() - 255000).toLocaleTimeString(),
  },
  // Stage — 工具调用（meta 存工具信息，actionView 点击查看详情）
  {
    id: 'demo-tool-1',
    role: 'assistant',
    stage: {
      title: '读取 package.json',
      status: 'success',
      success: '{"name":"my-project"}',
    },
    meta: {
      toolCallId: 'call-demo-001',
      toolName: 'node',
      label: 'node.readFile',
    },
    actionView: { label: '查看详情', data: { toolCallId: 'call-demo-001' } },
    timestamp: new Date(Date.now() - 250000).toLocaleTimeString(),
  },
  {
    id: 'demo-tool-2',
    role: 'assistant',
    stage: {
      title: 'npm install --save-dev typescript ts-node',
      status: 'success',
      success: 'added 3 packages in 2.1s',
    },
    meta: { toolCallId: 'call-demo-002', toolName: 'shell', label: 'shell' },
    actionView: { label: '查看详情', data: { toolCallId: 'call-demo-002' } },
    timestamp: new Date(Date.now() - 240000).toLocaleTimeString(),
  },
  {
    id: 'demo-tool-3',
    role: 'assistant',
    stage: {
      title: '使用 opencode 转换 src/ 目录下的所有 JS 文件',
      status: 'running',
    },
    meta: {
      toolCallId: 'call-demo-003',
      toolName: 'runtime',
      label: 'runtime',
    },
    timestamp: new Date(Date.now() - 230000).toLocaleTimeString(),
  },
  {
    id: 'demo-tool-4',
    role: 'assistant',
    stage: {
      title: '写入 tsconfig.json',
      status: 'error',
      error: 'EACCES: permission denied',
    },
    meta: {
      toolCallId: 'call-demo-004',
      toolName: 'node',
      label: 'node.writeFile',
    },
    actionView: { label: '查看详情', data: { toolCallId: 'call-demo-004' } },
    timestamp: new Date(Date.now() - 200000).toLocaleTimeString(),
  },
  // 问答示例
  {
    id: 'demo-8',
    role: 'assistant',
    content: '请确认以下操作：',
    asks: [
      {
        id: 'demo-ask-1',
        question: '是否覆盖现有配置文件？',
        options: ['是，覆盖', '否，保留'],
        optionActive: 1,
      },
    ],
    timestamp: new Date(Date.now() - 120000).toLocaleTimeString(),
  },
  {
    id: 'demo-9',
    role: 'user',
    content: '是，覆盖',
    timestamp: new Date(Date.now() - 100000).toLocaleTimeString(),
  },
  {
    id: 'demo-10',
    role: 'assistant',
    content:
      'TypeScript 重构完成！共转换 12 个文件，生成 tsconfig.json 和 types/index.ts。',
    timestamp: new Date(Date.now() - 80000).toLocaleTimeString(),
  },
]
