import { daysAgo, hoursAgo } from '../../../../../backend/src/storage/seed/util'

export const cronTasks = [
    {
        id: 1, name: '每日内容生成（早9点）', cron: '0 9 * * *',
        action: 'generate_articles', description: '每天早上 9 点自动为各产品生成当日内容计划，并交由 AI Agent 创作',
        status: 'enabled', agentId: 'agent-001',
        lastRun: daysAgo(0), nextRun: new Date(Date.now() + 72000000).toISOString(),
        successNotify: false,
        createdAt: daysAgo(20),
    },
    {
        id: 2, name: '多渠道定时发布（每日10点）', cron: '0 10 * * *',
        action: 'publish_articles', description: '每天10点将已完成审核的文章自动发布到 WordPress、Medium、掘金等渠道',
        status: 'enabled', agentId: 'agent-001',
        lastRun: daysAgo(0), nextRun: new Date(Date.now() + 75600000).toISOString(),
        successNotify: false,
        createdAt: daysAgo(18),
    },
    {
        id: 3, name: '周度 SEO 关键词排名报告', cron: '0 8 * * 1',
        action: 'seo_report', description: '每周一早上 8 点生成关键词排名变化、流量趋势和竞品动态分析报告',
        status: 'enabled', agentId: 'agent-002',
        lastRun: daysAgo(7), nextRun: new Date(Date.now() + 518400000).toISOString(),
        successNotify: false,
        createdAt: daysAgo(15),
    },
    {
        id: 4, name: '月度数据全局汇总', cron: '0 0 1 * *',
        action: 'monthly_report', description: '每月1日零点生成全平台内容数据汇总，包含流量、发布量、转化漏斗数据',
        status: 'enabled', agentId: null,
        lastRun: daysAgo(1), nextRun: new Date(Date.now() + 2592000000).toISOString(),
        successNotify: false,
        createdAt: daysAgo(30),
    },
    {
        id: 5, name: '竞品动态监控（每日）', cron: '0 7 * * *',
        action: 'competitor_monitor', description: '每天抓取竞品博客和社交媒体更新，自动提取选题灵感和内容缺口',
        status: 'enabled', agentId: 'agent-002',
        lastRun: daysAgo(0), nextRun: new Date(Date.now() + 68400000).toISOString(),
        successNotify: false,
        createdAt: daysAgo(12),
    },
    {
        id: 6, name: 'RSS 素材自动抓取', cron: '0 6 * * *',
        action: 'crawl_materials', description: '从 HackerNews、Product Hunt、X/Twitter 等渠道抓取行业热点素材',
        status: 'disabled', agentId: null,
        lastRun: daysAgo(5), nextRun: null,
        successNotify: false,
        createdAt: daysAgo(10),
    },
]

export const cronLogs: Record<number, any[]> = {
    1: [
        { id: 101, time: hoursAgo(24), success: true, message: '成功生成 14 篇文章任务（SaaS增长实验室 6 篇，AI工具深测 5 篇，出海创业手册 3 篇）' },
        { id: 102, time: hoursAgo(48), success: true, message: '成功生成 11 篇文章任务' },
        { id: 103, time: hoursAgo(72), success: false, message: 'GPT-4o API Rate Limit，等待 60 秒后自动重试成功' },
        { id: 104, time: hoursAgo(96), success: true, message: '成功生成 16 篇文章任务' },
        { id: 105, time: hoursAgo(120), success: true, message: '成功生成 13 篇文章任务' },
    ],
    2: [
        { id: 201, time: hoursAgo(24), success: true, message: '成功发布 13 篇文章到 5 个渠道（WordPress、Medium、掘金、微信公众号、Dev.to）' },
        { id: 202, time: hoursAgo(48), success: true, message: '成功发布 10 篇文章到 4 个渠道' },
        { id: 203, time: hoursAgo(72), success: false, message: '知乎接口 503，已跳过，其余 4 个渠道发布成功' },
    ],
    3: [
        { id: 301, time: daysAgo(7), success: true, message: '周报生成完毕：监控关键词 287 个，上涨 34 个，下降 12 个' },
        { id: 302, time: daysAgo(14), success: true, message: '周报生成完毕：监控关键词 265 个，上涨 19 个，下降 8 个' },
    ],
    5: [
        { id: 501, time: hoursAgo(24), success: true, message: '竞品监控完成：发现 「增长黑客」和「出海工具」类内容有新增趋势，生成选题建议 7 条' },
        { id: 502, time: hoursAgo(48), success: true, message: '竞品监控完成：Product Hunt 今日新上线 3 款 AI 内容工具，已生成竞品分析草稿' },
    ],
}

export const cronHistory = [
    { id: 1001, taskName: '每日内容生成（早9点）', time: hoursAgo(3), success: true, message: '生成 14 篇文章任务', agentId: 'agent-001' },
    { id: 1002, taskName: '多渠道定时发布（每日10点）', time: hoursAgo(4), success: true, message: '发布 13 篇文章至 5 个渠道', agentId: 'agent-001' },
    { id: 1003, taskName: '竞品动态监控（每日）', time: hoursAgo(5), success: true, message: '发现选题灵感 7 条', agentId: 'agent-002' },
    { id: 1004, taskName: '每日内容生成（早9点）', time: hoursAgo(27), success: true, message: '生成 11 篇文章任务', agentId: 'agent-001' },
    { id: 1005, taskName: '多渠道定时发布（每日10点）', time: hoursAgo(28), success: false, message: '知乎接口暂时不可用，跳过知乎，其余渠道已完成发布', agentId: 'agent-001' },
    { id: 1006, taskName: '月度数据全局汇总', time: daysAgo(1), success: true, message: '月度报告生成完毕，2月共发布 98 篇文章', agentId: null },
    { id: 1007, taskName: '周度 SEO 关键词排名报告', time: daysAgo(7), success: true, message: '周报已生成，核心词排名整体上升', agentId: 'agent-002' },
]
