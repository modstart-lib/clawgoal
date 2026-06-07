import { daysAgo } from '../../../../../backend/src/storage/seed/util'

export const projectTodos = [
    // project 1 — AI 内容自动化系统
    { id: 101, projectId: 1, title: '梳理选题策略并整理关键词池', status: 'done', priority: 'high', type: '策略', source: '内部', dueAt: '2026-01-20', activeAt: daysAgo(55), doneAt: daysAgo(52), createdAt: daysAgo(60) },
    { id: 102, projectId: 1, title: '完成 Model 写作质量基准测试文档', status: 'done', priority: 'medium', type: '文档', source: '内部', dueAt: '2026-02-05', activeAt: daysAgo(53), doneAt: daysAgo(50), createdAt: daysAgo(58) },
    { id: 103, projectId: 1, title: '集成 DALL-E 3 自动配图模块', status: 'done', priority: 'high', type: '开发', source: '内部', dueAt: '2026-02-25', activeAt: daysAgo(48), doneAt: daysAgo(45), createdAt: daysAgo(55) },
    { id: 104, projectId: 1, title: '完成微信公众号自动发布对接', status: 'active', priority: 'high', type: '开发', source: '内部', dueAt: '2026-03-18', activeAt: daysAgo(10), createdAt: daysAgo(30) },
    { id: 105, projectId: 1, title: '知乎 / 小红书格式适配', status: 'active', priority: 'high', type: '开发', source: '用户反馈', dueAt: '2026-03-25', activeAt: daysAgo(8), createdAt: daysAgo(28) },
    { id: 106, projectId: 1, title: '上线数据复盘仪表板初版', status: 'pending', priority: 'medium', type: '开发', source: '内部', dueAt: '2026-04-10', createdAt: daysAgo(20) },
    { id: 107, projectId: 1, title: '对接各平台数据回收 API', status: 'pending', priority: 'medium', type: '开发', source: '内部', dueAt: '2026-04-20', createdAt: daysAgo(15) },
    { id: 108, projectId: 1, title: '稳定性压测（100篇/天）', status: 'pool', priority: 'low', type: '测试', source: '内部', dueAt: '2026-04-28', createdAt: daysAgo(10) },
    { id: 109, projectId: 1, title: '内容评分与质量过滤机制', status: 'pool', priority: 'medium', type: '功能', source: '内部', dueAt: '2026-05-10', createdAt: daysAgo(8) },
    { id: 110, projectId: 1, title: '支持自定义发布时间排期', status: 'pool', priority: 'low', type: '功能', source: '用户反馈', dueAt: '2026-05-20', createdAt: daysAgo(6) },
    { id: 111, projectId: 1, title: '抖音 / 视频号短视频自动生成', status: 'pool', priority: 'low', type: '功能', source: '运营', dueAt: '2026-06-01', createdAt: daysAgo(5) },
    { id: 112, projectId: 1, title: '多语言功能调研', status: 'dropped', priority: 'low', type: '调研', source: '内部', reason: '范围过大，且多语言用户量不足以支撑投入', createdAt: daysAgo(40) },
    { id: 113, projectId: 1, title: 'WordPress 插件集成', status: 'dropped', priority: 'low', type: '集成', source: '用户反馈', reason: '目标用户群体以微信/知乎为主，WP 优先级低', createdAt: daysAgo(35) },

    // project 2 — 独立产品 MVP 上线
    { id: 201, projectId: 2, title: '竞品调研报告（Ahrefs / SEMrush）', status: 'done', priority: 'high', type: '调研', source: '内部', dueAt: '2026-02-08', activeAt: daysAgo(33), doneAt: daysAgo(30), createdAt: daysAgo(35) },
    { id: 202, projectId: 2, title: '完成 10 人用户访谈并整理需求', status: 'done', priority: 'high', type: '调研', source: '用户反馈', dueAt: '2026-02-20', activeAt: daysAgo(30), doneAt: daysAgo(28), createdAt: daysAgo(33) },
    { id: 203, projectId: 2, title: '搭建 Next.js + TailwindCSS 项目脚手架', status: 'done', priority: 'high', type: '开发', source: '内部', dueAt: '2026-03-01', activeAt: daysAgo(28), doneAt: daysAgo(25), createdAt: daysAgo(30) },
    { id: 204, projectId: 2, title: '关键词难度评分算法实现', status: 'active', priority: 'high', type: '开发', source: '内部', dueAt: '2026-03-28', activeAt: daysAgo(5), createdAt: daysAgo(18) },
    { id: 205, projectId: 2, title: '接入 Google Ads API 数据源', status: 'pending', priority: 'high', type: '开发', source: '内部', dueAt: '2026-04-02', createdAt: daysAgo(15) },
    { id: 206, projectId: 2, title: '支付系统集成（Stripe）', status: 'pending', priority: 'high', type: '开发', source: '内部', dueAt: '2026-04-15', createdAt: daysAgo(12) },
    { id: 207, projectId: 2, title: 'ProductHunt 发布预热文案准备', status: 'pending', priority: 'medium', type: '运营', source: '运营', dueAt: '2026-04-25', createdAt: daysAgo(10) },
    { id: 208, projectId: 2, title: '用户注册/登录功能开发', status: 'pending', priority: 'high', type: '开发', source: '内部', dueAt: '2026-04-08', createdAt: daysAgo(9) },
    { id: 209, projectId: 2, title: '邮件营销系统接入（Resend）', status: 'pool', priority: 'medium', type: '运营', source: '内部', dueAt: '2026-05-05', createdAt: daysAgo(7) },
    { id: 210, projectId: 2, title: '关键词批量导出（CSV/Excel）', status: 'pool', priority: 'medium', type: '功能', source: '用户反馈', dueAt: '2026-05-15', createdAt: daysAgo(6) },
    { id: 211, projectId: 2, title: '多用户协作工作空间', status: 'pool', priority: 'low', type: '功能', source: '用户反馈', dueAt: '2026-06-15', createdAt: daysAgo(4) },
    { id: 212, projectId: 2, title: 'API 开放平台（给开发者调用）', status: 'pool', priority: 'low', type: '功能', source: '内部', dueAt: '2026-07-01', createdAt: daysAgo(3) },
    { id: 213, projectId: 2, title: 'AI 智能推荐功能', status: 'dropped', priority: 'low', type: '功能', source: '内部', reason: '当前 MVP 阶段功能范围过大，延后到 v2 评估', createdAt: daysAgo(20) },

    // project 3 — 出海内容矩阵建设
    { id: 301, projectId: 3, title: '博客域名注册 + Vercel 部署', status: 'done', priority: 'high', type: '基础设施', source: '内部', dueAt: '2026-01-20', activeAt: daysAgo(50), doneAt: daysAgo(47), createdAt: daysAgo(52) },
    { id: 302, projectId: 3, title: 'Google Search Console 配置', status: 'done', priority: 'high', type: '基础设施', source: '内部', dueAt: '2026-01-25', activeAt: daysAgo(48), doneAt: daysAgo(46), createdAt: daysAgo(50) },
    { id: 303, projectId: 3, title: '发布 10 篇 Pillar Content（初稿）', status: 'done', priority: 'high', type: '内容', source: '内部', dueAt: '2026-02-28', activeAt: daysAgo(46), doneAt: daysAgo(44), createdAt: daysAgo(48) },
    { id: 304, projectId: 3, title: '为每篇文章添加内链和外链', status: 'active', priority: 'high', type: '内容', source: '内部', dueAt: '2026-03-15', activeAt: daysAgo(6), createdAt: daysAgo(25) },
    { id: 305, projectId: 3, title: '设置 Newsletter 订阅（Resend）', status: 'pending', priority: 'medium', type: '运营', source: '内部', dueAt: '2026-03-20', createdAt: daysAgo(22) },
    { id: 306, projectId: 3, title: '制作 Dev.to 内容同步发布流程', status: 'pending', priority: 'medium', type: '运营', source: '内部', dueAt: '2026-04-01', createdAt: daysAgo(18) },
    { id: 307, projectId: 3, title: '在 Reddit / HN 发布首篇推广帖', status: 'pool', priority: 'medium', type: '运营', source: '内部', dueAt: '2026-04-10', createdAt: daysAgo(15) },
    { id: 308, projectId: 3, title: '建立月度数据复盘文档模板', status: 'pending', priority: 'low', type: '文档', source: '内部', dueAt: '2026-04-30', createdAt: daysAgo(10) },
    { id: 309, projectId: 3, title: 'Twitter/X 账号内容运营启动', status: 'pool', priority: 'medium', type: '运营', source: '运营', dueAt: '2026-04-20', createdAt: daysAgo(8) },
    { id: 310, projectId: 3, title: '制作英文版白皮书（SaaS Growth Guide）', status: 'pool', priority: 'low', type: '内容', source: '内部', dueAt: '2026-05-10', createdAt: daysAgo(7) },
    { id: 311, projectId: 3, title: '联系 5 位出海博主进行互推合作', status: 'pool', priority: 'medium', type: '运营', source: '运营', dueAt: '2026-05-25', createdAt: daysAgo(5) },
    { id: 312, projectId: 3, title: '搭建英文版 YouTube 频道', status: 'dropped', priority: 'low', type: '渠道', source: '内部', reason: '当前视频制作资源不足，优先文字内容', createdAt: daysAgo(30) },

    // project 4 — 公众号 SEO 专项优化（已完成项目，含完整需求池）
    { id: 401, projectId: 4, title: '对全部历史文章完成关键词诊断', status: 'done', priority: 'high', type: '内容优化', source: '内部', dueAt: '2025-11-15', activeAt: daysAgo(122), doneAt: daysAgo(118), createdAt: daysAgo(130) },
    { id: 402, projectId: 4, title: '优先处理阅读量 TOP 50 文章', status: 'done', priority: 'high', type: '内容优化', source: '内部', dueAt: '2025-12-01', activeAt: daysAgo(118), doneAt: daysAgo(110), createdAt: daysAgo(125) },
    { id: 403, projectId: 4, title: '更新 2024 年及以前的过时数据', status: 'done', priority: 'medium', type: '内容优化', source: '内部', dueAt: '2025-12-20', activeAt: daysAgo(110), doneAt: daysAgo(100), createdAt: daysAgo(118) },
    { id: 404, projectId: 4, title: '完成 A/B 标题测试（共 30 篇）', status: 'done', priority: 'medium', type: '测试', source: '内部', dueAt: '2026-01-15', activeAt: daysAgo(100), doneAt: daysAgo(80), createdAt: daysAgo(105) },
    { id: 405, projectId: 4, title: '复盘并输出 SEO 优化效果报告', status: 'done', priority: 'medium', type: '文档', source: '内部', dueAt: '2026-01-31', activeAt: daysAgo(80), doneAt: daysAgo(63), createdAt: daysAgo(85) },
    { id: 406, projectId: 4, title: '图片 ALT 标签批量补充优化', status: 'dropped', priority: 'low', type: '内容优化', source: '内部', reason: '公众号不支持自定义 ALT，无法落地', createdAt: daysAgo(80) },

    // project 5 — 品牌视觉形象升级（暂停中）
    { id: 501, projectId: 5, title: '确定品牌关键词与目标受众画像', status: 'done', priority: 'high', type: '策略', source: '内部', dueAt: '2026-02-22', activeAt: daysAgo(20), doneAt: daysAgo(18), createdAt: daysAgo(22) },
    { id: 502, projectId: 5, title: '外包 Logo 设计（3 稿定稿）', status: 'active', priority: 'high', type: '设计', source: '内部', dueAt: '2026-03-15', activeAt: daysAgo(10), createdAt: daysAgo(17) },
    { id: 503, projectId: 5, title: '输出 Brand Guideline 文档', status: 'pending', priority: 'medium', type: '文档', source: '内部', dueAt: '2026-03-25', createdAt: daysAgo(12) },
    { id: 504, projectId: 5, title: '制作 20 套社交媒体封面模板', status: 'pending', priority: 'medium', type: '设计', source: '内部', dueAt: '2026-04-05', createdAt: daysAgo(10) },
    { id: 505, projectId: 5, title: '全渠道品牌物料替换上线', status: 'pending', priority: 'medium', type: '运营', source: '内部', dueAt: '2026-04-15', createdAt: daysAgo(8) },
    { id: 506, projectId: 5, title: '配套设计系统（Figma Token）搭建', status: 'pool', priority: 'low', type: '设计', source: '内部', dueAt: '2026-05-01', createdAt: daysAgo(5) },
    { id: 507, projectId: 5, title: '品牌动效规范（Lottie/CSS动画）', status: 'pool', priority: 'low', type: '设计', source: '内部', dueAt: '2026-05-20', createdAt: daysAgo(3) },
    { id: 508, projectId: 5, title: '线下物料设计（名片/易拉宝等）', status: 'dropped', priority: 'low', type: '设计', source: '内部', reason: '当前以线上为主，线下物料暂无需求', createdAt: daysAgo(15) },

    // project 6 — 2026 年度内容日历规划
    { id: 601, projectId: 6, title: '梳理全年重要节点与行业大事（Q1–Q4）', status: 'active', priority: 'high', type: '策略', source: '内部', dueAt: '2026-03-08', activeAt: daysAgo(3), createdAt: daysAgo(3) },
    { id: 602, projectId: 6, title: '确定 12 个月度主题方向', status: 'active', priority: 'high', type: '策略', source: '内部', dueAt: '2026-03-15', activeAt: daysAgo(2), createdAt: daysAgo(3) },
    { id: 603, projectId: 6, title: '搭建选题库（目标积累 200+ 备用选题）', status: 'pending', priority: 'high', type: '内容', source: '内部', dueAt: '2026-03-22', createdAt: daysAgo(3) },
    { id: 604, projectId: 6, title: '制作 5 套可复用内容模板', status: 'pending', priority: 'medium', type: '设计', source: '内部', dueAt: '2026-03-28', createdAt: daysAgo(2) },
    { id: 605, projectId: 6, title: '完成年度内容日历并同步到团队', status: 'pending', priority: 'high', type: '运营', source: '内部', dueAt: '2026-03-31', createdAt: daysAgo(2) },
    { id: 606, projectId: 6, title: '制定节日营销方案（春节、618、双11等）', status: 'pending', priority: 'medium', type: '策略', source: '运营', dueAt: '2026-04-10', createdAt: daysAgo(1) },
    { id: 607, projectId: 6, title: '接入 AI 辅助选题生成工具', status: 'pool', priority: 'medium', type: '开发', source: '内部', dueAt: '2026-04-20', createdAt: daysAgo(1) },
    { id: 608, projectId: 6, title: '建立内容效果追踪数据看板', status: 'pool', priority: 'medium', type: '开发', source: '内部', dueAt: '2026-05-01', createdAt: daysAgo(1) },
    { id: 609, projectId: 6, title: '制作 B 站 / 微博平台适配模板', status: 'pool', priority: 'low', type: '设计', source: '运营', dueAt: '2026-05-10', createdAt: daysAgo(1) },
    { id: 610, projectId: 6, title: '外包内容日历视觉排版设计', status: 'dropped', priority: 'low', type: '设计', source: '内部', reason: '决定内部使用 Notion 模板，无需外包，节约成本', createdAt: daysAgo(2) },
]
