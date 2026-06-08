import { daysAgo, hoursAgo } from '../../../../../backend/src/storage/seed/util'

export const taskJobs = [
  {
    id: 1, agentId: 1, source: 'task', taskId: 1, sort: 1, status: 'done',
    input: '分析 PLG Freemium 转化率数据，整理近半年核心指标趋势',
    output: '已完成分析，免费转付费转化率均值 4.2%，高于行业基准 3.1%',
    createdAt: daysAgo(1),
  },
  {
    id: 2, agentId: 1, source: 'task', taskId: 1, sort: 2, status: 'done',
    input: '撰写文章大纲：核心论点、章节结构、案例选择',
    output: '大纲已生成，共 6 章节，涵盖数据背景、策略分析与实践建议',
    createdAt: daysAgo(1),
  },
  {
    id: 3, agentId: 1, source: 'task', taskId: 1, sort: 3, status: 'done',
    input: '根据大纲撰写完整正文，目标字数 4000+',
    output: '正文已生成，共 4217 字，附参考来源 12 条',
    createdAt: daysAgo(1),
  },
  {
    id: 4, agentId: 1, source: 'task', taskId: 2, sort: 1, status: 'done',
    input: '将已审核文章格式化为 WordPress Gutenberg 块结构',
    output: '格式转换完成，已生成 WordPress XML 导入文件',
    createdAt: daysAgo(1),
  },
  {
    id: 5, agentId: 1, source: 'task', taskId: 2, sort: 2, status: 'done',
    input: '发布到 WordPress 主站，配置 SEO 元信息',
    output: '发布成功，URL: /blog/ai-content-10x-efficiency，已设置 Meta 描述',
    createdAt: daysAgo(1),
  },
  {
    id: 6, agentId: 1, source: 'task', taskId: 2, sort: 3, status: 'done',
    input: '将文章适配为 Medium 英文格式并发布',
    output: null,
    createdAt: daysAgo(1),
  },
  {
    id: 7, agentId: 3, source: 'task', taskId: 3, sort: 1, status: 'done',
    input: '收集 n8n、Make、Zapier 官方文档与定价页面',
    output: '已收集 3 款工具最新功能列表和定价数据，保存至工作区',
    createdAt: hoursAgo(2),
  },
  {
    id: 8, agentId: 3, source: 'task', taskId: 3, sort: 2, status: 'done',
    input: '撰写第一、二章：功能对比与 AI 集成能力分析',
    output: '已完成两章，共 2100 字，含 Feature Matrix 对比表格',
    createdAt: hoursAgo(1),
  },
  {
    id: 9, agentId: 3, source: 'task', taskId: 3, sort: 3, status: 'done',
    input: '撰写第三章：价格对比与选型建议',
    output: null,
    createdAt: hoursAgo(1),
  },
  {
    id: 10, agentId: 2, source: 'task', taskId: 4, sort: 1, status: 'pending',
    input: '查询「SaaS增长」相关关键词搜索量及竞争难度数据',
    output: null,
    createdAt: hoursAgo(2),
  },
  {
    id: 11, agentId: 1, source: 'task', taskId: 5, sort: 1, status: 'done',
    input: '调用 GPT-4o 生成文章初稿：SaaS定价的7个反直觉原则',
    output: null,
    createdAt: hoursAgo(5),
  },
  {
    id: 12, agentId: 1, source: 'task', taskId: 5, sort: 2, status: 'failed',
    input: '对初稿进行深度润色并添加真实案例数据',
    output: 'GPT-4o 调用超时，请手动重试',
    createdAt: hoursAgo(4),
  },
  {
    id: 13, agentId: 2, source: 'task', taskId: 6, sort: 1, status: 'done',
    input: '抓取 Product Hunt 今日新上线内容工具',
    output: '发现 2 款新工具：ContentAI Pro、WriteMind，已生成摘要',
    createdAt: hoursAgo(3),
  },
  {
    id: 14, agentId: 2, source: 'task', taskId: 6, sort: 2, status: 'done',
    input: '抓取 HackerNews 今日相关内容工具讨论',
    output: '发现 1 款工具：CopyGenius，热度 342 points，已生成摘要',
    createdAt: hoursAgo(3),
  },
  {
    id: 15, agentId: 2, source: 'task', taskId: 6, sort: 3, status: 'done',
    input: '汇总生成竞品快报 Markdown 文档',
    output: '竞品快报已生成，共 3 款工具，含功能对比与威胁度评估',
    createdAt: hoursAgo(3),
  },
  {
    id: 16, agentId: 4, source: 'oneshot', taskId: 0, sort: 1, status: 'canceled',
    input: '将「独立开发者出海选品策略」中文文章翻译为英文',
    output: null,
    createdAt: hoursAgo(1),
  },

  // ── Task 7: 翻译：独立开发者出海选品策略（英文版） ─────────────────────────────
  {
    id: 17, agentId: 4, source: 'task', taskId: 7, sort: 1, status: 'done',
    input: '读取原文并拆分段落，识别核心术语与专有名词列表',
    output: null,
    createdAt: hoursAgo(1),
  },
  {
    id: 18, agentId: 4, source: 'task', taskId: 7, sort: 2, status: 'done',
    input: '逐段翻译为英文，保持原文语气风格，适配欧美读者习惯',
    output: null,
    createdAt: hoursAgo(1),
  },
  {
    id: 19, agentId: 4, source: 'task', taskId: 7, sort: 3, status: 'done',
    input: '校对英文全文，优化 Dev.to / Hashnode 平台格式（标题、代码块、标签）',
    output: null,
    createdAt: hoursAgo(1),
  },
  {
    id: 20, agentId: 4, source: 'task', taskId: 7, sort: 4, status: 'done',
    input: '生成英文 SEO 元信息：title、description、slug、canonical',
    output: null,
    createdAt: hoursAgo(1),
  },

  // ── Task 8: 生成：技术创业周报 Vol.12 ─────────────────────────────────────────
  {
    id: 21, agentId: 3, source: 'task', taskId: 8, sort: 1, status: 'done',
    input: '抓取本周 TechCrunch、36氪、Product Hunt 重要融资与产品发布事件',
    output: null,
    createdAt: hoursAgo(0),
  },
  {
    id: 22, agentId: 3, source: 'task', taskId: 8, sort: 2, status: 'done',
    input: '筛选本周 GitHub Trending 高热度开源项目，生成简报摘要',
    output: null,
    createdAt: hoursAgo(0),
  },
  {
    id: 23, agentId: 3, source: 'task', taskId: 8, sort: 3, status: 'done',
    input: '整合所有素材，撰写周报正文，包含编辑点评与行业洞察',
    output: null,
    createdAt: hoursAgo(0),
  },
  {
    id: 24, agentId: 3, source: 'task', taskId: 8, sort: 4, status: 'done',
    input: '排版周报并推送至邮件订阅列表（Newsletter）',
    output: null,
    createdAt: hoursAgo(0),
  },

  // ── oneshot 即时任务 ────────────────────────────────────────────────────────
  {
    id: 25, agentId: 2, source: 'oneshot', taskId: 0, sort: 1, status: 'done',
    input: '查找「No-code AI tools 2025」相关长尾关键词，列出搜索量 Top 20',
    output: '已找到 20 个长尾词，平均月搜索量 1200，Top 1 为「best no-code ai tools 2025」(月搜 8100)',
    createdAt: hoursAgo(6),
  },
  {
    id: 26, agentId: 1, source: 'oneshot', taskId: 0, sort: 1, status: 'done',
    input: '分析竞争对手 BlogAI 的内容矩阵，找出内容空白机会',
    output: '发现 3 条内容空白：「AI写作 vs 人工写作对比」「AI内容工具定价指南」「AI工具替代人工的边界研究」',
    createdAt: hoursAgo(8),
  },
  {
    id: 27, agentId: 1, source: 'oneshot', taskId: 0, sort: 1, status: 'failed',
    input: '爬取 Ahrefs 域名权重数据进行竞品评估',
    output: '请求被拦截（403），目标站点启用了反爬机制，建议改用 SimilarWeb API',
    createdAt: hoursAgo(7),
  },
  {
    id: 28, agentId: 4, source: 'oneshot', taskId: 0, sort: 1, status: 'done',
    input: '将 Product Hunt 上线文案翻译为中文，并适配国内科技媒体语态',
    output: '翻译完成，共 320 字，已调整3处文化差异表达，附对照原文',
    createdAt: daysAgo(2),
  },
  {
    id: 29, agentId: 2, source: 'oneshot', taskId: 0, sort: 1, status: 'done',
    input: '为文章「SaaS产品冷启动」生成 10 条 Twitter/X 宣传文案（含 hashtag）',
    output: '已生成 10 条文案，预计曝光量 5000+，最佳发布时间建议：周二 10:00 EST',
    createdAt: daysAgo(2),
  },
  {
    id: 30, agentId: 3, source: 'oneshot', taskId: 0, sort: 1, status: 'pending',
    input: '根据最新 Web 开发趋势，提出下周选题方向 5 条（含爆款潜力分析）',
    output: null,
    createdAt: hoursAgo(3),
  },
]
