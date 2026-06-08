import path from 'path'
import { daysAgo } from '../../../../../backend/src/storage/seed/util'

// 使用文件自身位置计算项目根目录，避免依赖 process.cwd()（在 packages/backend 下启动时会路径偏移）
const PROJECT_ROOT = path.resolve(import.meta.dir, '../../../../../..')

export const agents = [
    {
        id: 2, title: '李白',
        description: '专业内容写作助手，擅长博客文章、营销文案和 SEO 内容创作',
        roleName: 'writer', active: true, workStatus: 'idle', avatar: '/api/mock/randomAvatar?seed=writer',
        channelIds: [], projectId: 1,
        createdAt: daysAgo(20),
        config: {
            name: 'writer', title: 'Writer',
            description: '专业内容写作助手',
            model: { temperature: 0.7, maxTokens: 4096 },
            capabilities: { tools: [] },
            models: { default: { name: 'default', temperature: 0.7, maxTokens: 4096 } },
        },
    },
    {
        id: 13, title: '鲁班',
        description: '专业软件工程师，负责代码开发与调试。',
        roleName: 'programer', active: true, workStatus: 'idle', avatar: '/api/mock/randomAvatar?seed=lu-ban',
        channelIds: [], projectId: 2,
        createdAt: daysAgo(30),
        param: { codespace: path.join(PROJECT_ROOT, 'storage/test-workspace'), runtime: 'local', runner: 'opencode' },
        config: {
            name: 'programer', title: '鲁班',
            description: '巧夺天工的匠人祖师，精通架构设计与代码实现，化腐朽为神奇',
            model: { temperature: 0.3, maxTokens: 8192 },
            capabilities: { tools: ['runtime_list', 'runtime_execute', 'runtime_system_info', 'runtime_shell', 'runtime_file_read', 'runtime_file_write', 'runtime_grep', 'audit_codespace_submit', 'audit_codespace_accept', 'audit_codespace_change', 'audit_codespace_cancel'], skills: ['programer-dev-init', 'programer-test-init'], mcps: [] },
            models: { default: { name: 'default', temperature: 0.3, maxTokens: 8192 } },
        },
    },
    {
        id: 14, title: '鬼谷子',
        description: '多步骤研究智能体，系统性收集信息、综合分析并输出结构化研究报告。',
        roleName: 'researcher', active: true, workStatus: 'idle', avatar: '/api/mock/randomAvatar?seed=gui-gu-zi',
        channelIds: [], projectId: 3,
        createdAt: daysAgo(30),
        config: {
            name: 'researcher', title: '鬼谷子',
            description: '博学多才，系统研究，善出奇谋，深度洞察',
            model: { temperature: 0.3, maxTokens: 8192 },
            capabilities: { tools: ['web_batch_search', 'web_batch_fetch'], skills: [], mcps: [] },
            models: { default: { name: 'default', temperature: 0.3, maxTokens: 8192 } },
        },
    },
    {
        id: 15, title: '上官婉儿',
        description: '自动识别并捕获每条消息中的灵感，提炼后存入灵感项目笔记。',
        roleName: 'sparkCatcher', active: true, workStatus: 'idle', avatar: '/api/mock/randomAvatar?seed=shangguan-waner',
        channelIds: [], projectId: 1,
        createdAt: daysAgo(30),
        config: {
            name: 'sparkCatcher', title: '上官婉儿',
            description: '才情卓绝，博闻强识，精于捕捉灵光一现的想法',
            model: { temperature: 0.3, maxTokens: 4096 },
            capabilities: { tools: ['project_list', 'note_list', 'note_get', 'note_search', 'note_batch_add', 'note_batch_edit', 'note_batch_delete'], skills: [], mcps: [] },
            models: { default: { name: 'default', temperature: 0.3, maxTokens: 4096 } },
        },
    },
]

export const agentRoles = [
    { name: 'writer', title: '内容创作者' },
    { name: 'sparkCatcher', title: '灵感记录者' },
]
