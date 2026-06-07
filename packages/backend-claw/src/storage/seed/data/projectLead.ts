import { daysAgo } from '../../../../../backend/src/storage/seed/util'

export const projectLeads: Record<number, any[]> = {
    1: [
        { id: 101, projectId: 1, name: '字节跳动内容合作部', status: 'qualified', source: '内部推荐', contact: 'business@bytedance.com', note: '希望接入 AI 写作系统，为旗下媒体提供内容生产支持，意向明确', date: '2026-02-28', createdAt: daysAgo(4) },
        { id: 102, projectId: 1, name: '新榜运营总监 —— 李文', status: 'contacted', source: '行业峰会', contact: 'liwen@newrank.cn', note: '了解到项目后主动联系，讨论数据对接合作可能性', date: '2026-02-20', createdAt: daysAgo(11) },
        { id: 103, projectId: 1, name: '某出版集团数字部', status: 'contacted', source: '官网留言', contact: '13800138001', note: '传统出版转型，想引入 AI 辅助编辑流程', date: '2026-02-15', createdAt: daysAgo(16) },
        { id: 104, projectId: 1, name: '自媒体博主 —— 科技小A', status: 'new', source: '微博私信', contact: '@科技小A', note: '粉丝 50 万，询问是否提供 B 端服务或联名合作', date: '2026-03-01', createdAt: daysAgo(2) },
        { id: 105, projectId: 1, name: '某高校传播学院', status: 'lost', source: '朋友推荐', contact: 'media@example.edu.cn', note: '预算受限，项目搁置，后续可跟进', date: '2026-01-30', createdAt: daysAgo(32) },
        { id: 106, projectId: 1, name: '知乎机构号 —— 极客研习社', status: 'qualified', source: 'LinkedIn', contact: 'geek@zhihu.com', note: '月产内容需求 60+ 篇，愿意付费试用 3 个月', date: '2026-02-25', createdAt: daysAgo(6) },
    ],
    2: [
        { id: 201, projectId: 2, name: 'SEO 团队负责人 —— 张伟', status: 'qualified', source: 'ProductHunt', contact: 'zhangwei@seoagency.com', note: '团队 15 人，每月关键词研究需求旺盛，愿意付费 $29/月', date: '2026-02-22', createdAt: daysAgo(9) },
        { id: 202, projectId: 2, name: '独立站卖家 —— Mike', status: 'contacted', source: 'Twitter', contact: '@mike_shopify', note: '独立站月流量约 3 万，希望用工具提升 SEO 效果', date: '2026-02-18', createdAt: daysAgo(13) },
        { id: 203, projectId: 2, name: '跨境电商培训机构', status: 'new', source: '小红书', contact: '微信：cross_train', note: '有学员群体，可能合作推广', date: '2026-03-02', createdAt: daysAgo(1) },
        { id: 204, projectId: 2, name: 'V2EX 网友 —— foobar', status: 'lost', source: 'V2EX', contact: 'foobar@v2ex.com', note: '体验了 Demo，觉得功能还不够，暂不付费', date: '2026-02-10', createdAt: daysAgo(21) },
        { id: 205, projectId: 2, name: '内容营销顾问 —— 陈晴', status: 'contacted', source: '朋友推荐', contact: 'chenqing@content.com', note: '为多个 B2B 客户做内容策略，有意向批量采购账号', date: '2026-02-26', createdAt: daysAgo(5) },
    ],
    3: [
        { id: 301, projectId: 3, name: 'IndieHackers 用户 —— Robin', status: 'contacted', source: 'IndieHackers', contact: 'robin@indiehacker.io', note: '对出海内容方法论感兴趣，已参与 Newsletter 订阅', date: '2026-02-19', createdAt: daysAgo(12) },
        { id: 302, projectId: 3, name: 'Dev.to 编辑 —— Sarah', status: 'qualified', source: 'Dev.to', contact: 'sarah@dev.to', note: '邀请成为 Dev.to 精选作者，可获官方流量扶持', date: '2026-02-24', createdAt: daysAgo(7) },
        { id: 303, projectId: 3, name: 'Reddit 版主 —— u/saas_talk', status: 'new', source: 'Reddit', contact: 'u/saas_talk', note: '对内容有兴趣，可能推荐到 r/SaaS subreddit', date: '2026-03-01', createdAt: daysAgo(2) },
        { id: 304, projectId: 3, name: '海外华人创业社群', status: 'contacted', source: '微信群', contact: '微信：oversea_dev', note: '社群 2000+ 人，可投放内容', date: '2026-02-12', createdAt: daysAgo(19) },
    ],
    4: [
        { id: 401, projectId: 4, name: '知乎 SEO 专栏合作', status: 'qualified', source: '知乎', contact: 'seo@zhihu.com', note: '知乎主动联系，邀请参与 SEO 专题合作', date: '2025-12-15', createdAt: daysAgo(78) },
        { id: 402, projectId: 4, name: '百度搜索资源平台', status: 'qualified', source: '官方邀请', contact: 'webmaster@baidu.com', note: '通过百度站长平台获得内容合作资质', date: '2025-11-20', createdAt: daysAgo(103) },
        { id: 403, projectId: 4, name: 'SEO 工具商 A', status: 'lost', source: 'Google', contact: 'sales@seo-tool.com', note: '工具价格超出预算', date: '2025-12-01', createdAt: daysAgo(92) },
    ],
    5: [
        { id: 501, projectId: 5, name: '设计师 —— 小宇宙工作室', status: 'contacted', source: 'Behance', contact: 'hello@cosmos-studio.cn', note: '擅长科技风格，报价 8000 元，风格符合预期', date: '2026-02-20', createdAt: daysAgo(11) },
        { id: 502, projectId: 5, name: 'Freelancer 设计师 —— 阿飞', status: 'new', source: '猪八戒网', contact: '微信：afei_design', note: '价格较低，质量待评估', date: '2026-02-28', createdAt: daysAgo(3) },
    ],
    6: [
        { id: 601, projectId: 6, name: '内容策略咨询师 —— 周明', status: 'new', source: '微信', contact: '微信：zhouming_content', note: '愿意合作整理年度内容日历模板', date: '2026-03-02', createdAt: daysAgo(1) },
    ],
}
