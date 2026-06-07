import { daysAgo } from '../../../../../backend/src/storage/seed/util';

/** 对应 claw_objective 表 */
export const objectives = [
    {
        id: 1, title: 'Q1 SEO 流量冲刺计划',
        description: '通过内容矩阵建设，Q1 自然流量目标从 8000/月提升到 30000/月',
        status: 'active', icon: 'rocket', result: '',
        projectId: 1, startAt: daysAgo(20), endAt: null,
        createdAt: daysAgo(20),
    },
    {
        id: 2, title: '品牌专家形象打造',
        description: '通过高质量深度内容，建立 SaaS 增长领域的专家 IP，提升品牌信任度',
        status: 'active', icon: 'target', result: '',
        projectId: 1, startAt: daysAgo(30), endAt: null,
        createdAt: daysAgo(30),
    },
    {
        id: 3, title: '出海内容国际化',
        description: '将核心中文内容本地化为英文，打入 Product Hunt / Reddit / HackerNews 流量场',
        status: 'active', icon: 'flame', result: '',
        projectId: 3, startAt: daysAgo(45), endAt: null,
        createdAt: daysAgo(45),
    },
    {
        id: 4, title: '变现体系搭建',
        description: '从流量到收入的完整转化链路建设，目标月营收 ¥30000',
        status: 'completed', icon: 'target', result: '等待自然流量稳定后启动付费变现',
        projectId: 2, startAt: daysAgo(60), endAt: daysAgo(10),
        createdAt: daysAgo(60),
    },
]

/** 对应 claw_objective_action 表 */
export const objectiveActions = [
    // ── Objective 1: Q1 SEO 流量冲刺计划 ─────────────────────────────────────
    { id: 1,  objectiveId: 1, title: '完成 80 篇 SEO 长尾内容发布',              detail: '',                                         status: 'done',       createdAt: daysAgo(20) },
    { id: 2,  objectiveId: 1, title: '打造 3 篇 10 万+ 爆款文章',                detail: '',                                         status: 'done',       createdAt: daysAgo(18) },
    { id: 3,  objectiveId: 1, title: '完成外链建设',                              detail: '目标 50 条高质量 Backlink',                status: 'running',    createdAt: daysAgo(15) },
    { id: 4,  objectiveId: 1, title: '接入 Medium + Dev.to 英文渠道',             detail: '',                                         status: 'done',       createdAt: daysAgo(14) },
    { id: 5,  objectiveId: 1, title: '搭建全自动化发布流水线',                    detail: '',                                         status: 'running',    createdAt: daysAgo(10) },
    { id: 6,  objectiveId: 1, title: '完成关键词矩阵规划',                        detail: '覆盖 200+ 长尾词，按竞争度分级',           status: 'done',       createdAt: daysAgo(19) },
    { id: 7,  objectiveId: 1, title: '接入 Google Search Console 监控',           detail: '',                                         status: 'done',       createdAt: daysAgo(17) },
    { id: 8,  objectiveId: 1, title: '优化首批文章的内链结构',                    detail: '目标每篇文章 3 条以上内链',                status: 'running',    createdAt: daysAgo(8)  },
    { id: 9,  objectiveId: 1, title: '完成站点 Core Web Vitals 优化',             detail: 'LCP < 2.5s，CLS < 0.1',                   status: 'running',    createdAt: daysAgo(5)  },
    // ── Objective 2: 品牌专家形象打造 ────────────────────────────────────────
    { id: 10, objectiveId: 2, title: '完成《SaaS增长方法论》白皮书写作',          detail: '',                                         status: 'running',    createdAt: daysAgo(30) },
    { id: 11, objectiveId: 2, title: '产出 5 篇头部 KOL 联合内容',               detail: '',                                         status: 'done',       createdAt: daysAgo(28) },
    { id: 12, objectiveId: 2, title: '微信公众号涨粉至 5000+',                   detail: '',                                         status: 'running',    createdAt: daysAgo(25) },
    { id: 13, objectiveId: 2, title: '开通 Newsletter 邮件订阅',                 detail: '',                                         status: 'done',       createdAt: daysAgo(22) },
    { id: 14, objectiveId: 2, title: '完成个人官网品牌页建设',                    detail: '含案例展示、媒体资源包下载',               status: 'done',       createdAt: daysAgo(26) },
    { id: 15, objectiveId: 2, title: '在知乎运营专栏并达到 1000 关注',            detail: '',                                         status: 'running',    createdAt: daysAgo(20) },
    { id: 16, objectiveId: 2, title: '录制品牌宣传短视频（3 期）',               detail: '发布至 B 站 + 视频号',                    status: 'canceled',   createdAt: daysAgo(10) },
    // ── Objective 3: 出海内容国际化 ──────────────────────────────────────────
    { id: 17, objectiveId: 3, title: '翻译并发布 20 篇核心英文文章',              detail: '',                                         status: 'running',    createdAt: daysAgo(45) },
    { id: 18, objectiveId: 3, title: '在 Product Hunt 发布产品并进入前 5',        detail: '',                                         status: 'running',    createdAt: daysAgo(40) },
    { id: 19, objectiveId: 3, title: '开通 Hashnode 技术博客',                   detail: '',                                         status: 'done',       createdAt: daysAgo(35) },
    { id: 20, objectiveId: 3, title: '在 Reddit r/SaaS 发帖并获得 100+ upvotes', detail: '',                                         status: 'running',    createdAt: daysAgo(30) },
    { id: 21, objectiveId: 3, title: '在 HackerNews Show HN 发布并进入首页',     detail: '',                                         status: 'canceled',   createdAt: daysAgo(25) },
    { id: 22, objectiveId: 3, title: '搭建英文 Twitter/X 账号并积累 500 粉丝',   detail: '',                                         status: 'running',    createdAt: daysAgo(38) },
    { id: 23, objectiveId: 3, title: '完成 Indie Hackers 产品页并发布里程碑',    detail: '',                                         status: 'running',    createdAt: daysAgo(28) },
    // ── Objective 4: 变现体系搭建 ────────────────────────────────────────────
    { id: 24, objectiveId: 4, title: '上线付费内容专栏（知识星球/小报童）',       detail: '',                                         status: 'done',       createdAt: daysAgo(60) },
    { id: 25, objectiveId: 4, title: '接入 Affiliate 联盟推广',                  detail: '',                                         status: 'done',       createdAt: daysAgo(55) },
    { id: 26, objectiveId: 4, title: '设计 3 档订阅会员方案',                    detail: 'Basic / Pro / Enterprise 差异化权益',      status: 'done',       createdAt: daysAgo(50) },
    { id: 27, objectiveId: 4, title: '完成支付系统接入（Stripe + 微信支付）',    detail: '',                                         status: 'done',       createdAt: daysAgo(45) },
    { id: 28, objectiveId: 4, title: '搭建用户转化漏斗分析看板',                 detail: '追踪 注册→试用→付费 转化率',              status: 'done',       createdAt: daysAgo(40) },
]

/** @deprecated use objectives */
export const objectiveProjects = objectives;
