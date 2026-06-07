import { daysAgo } from '../../../../../backend/src/storage/seed/util'

// ── 指标定义（每个项目 5 个指标）────────────────────────────────────────────────
export const metricDefs = [
    // project 1 — AI 内容自动化系统
    { id: 101, projectId: 1, name: 'pv',        title: 'PV 访问量',  sort: 10, createdAt: daysAgo(52) },
    { id: 102, projectId: 1, name: 'income',    title: '收入（元）', sort: 20, createdAt: daysAgo(52) },
    { id: 103, projectId: 1, name: 'refund',    title: '退款（元）', sort: 30, createdAt: daysAgo(52) },
    { id: 104, projectId: 1, name: 'userCount', title: '用户数',     sort: 40, createdAt: daysAgo(52) },
    { id: 105, projectId: 1, name: 'dau',       title: 'DAU 日活',   sort: 50, createdAt: daysAgo(52) },
    // project 2 — 独立产品 MVP 上线
    { id: 201, projectId: 2, name: 'pv',        title: 'PV 访问量',  sort: 10, createdAt: daysAgo(30) },
    { id: 202, projectId: 2, name: 'income',    title: '收入（元）', sort: 20, createdAt: daysAgo(30) },
    { id: 203, projectId: 2, name: 'refund',    title: '退款（元）', sort: 30, createdAt: daysAgo(30) },
    { id: 204, projectId: 2, name: 'userCount', title: '用户数',     sort: 40, createdAt: daysAgo(30) },
    { id: 205, projectId: 2, name: 'dau',       title: 'DAU 日活',   sort: 50, createdAt: daysAgo(30) },
    // project 3 — 出海内容矩阵建设
    { id: 301, projectId: 3, name: 'pv',        title: 'PV 访问量',   sort: 10, createdAt: daysAgo(47) },
    { id: 302, projectId: 3, name: 'income',    title: '广告收入（$）',sort: 20, createdAt: daysAgo(47) },
    { id: 303, projectId: 3, name: 'userCount', title: '月活读者',    sort: 30, createdAt: daysAgo(47) },
    { id: 304, projectId: 3, name: 'newsletter',title: 'Newsletter 订阅', sort: 40, createdAt: daysAgo(47) },
    { id: 305, projectId: 3, name: 'reactions', title: 'Dev.to Reactions', sort: 50, createdAt: daysAgo(47) },
    // project 6 — 2026 年度内容日历规划
    { id: 601, projectId: 6, name: 'topicCount',    title: '已规划选题数',   sort: 10, createdAt: daysAgo(3) },
    { id: 602, projectId: 6, name: 'templateCount', title: '模板完成数',     sort: 20, createdAt: daysAgo(3) },
    { id: 603, projectId: 6, name: 'monthsPlanned', title: '已完成月度方案', sort: 30, createdAt: daysAgo(3) },
    { id: 604, projectId: 6, name: 'platformCount', title: '覆盖平台数',     sort: 40, createdAt: daysAgo(3) },
    { id: 605, projectId: 6, name: 'contentGoal',   title: '计划内容总量',   sort: 50, createdAt: daysAgo(3) },
]

// ── 工具：生成某天的日期字符串（YYYY-MM-DD） ─────────────────────────────────────
function dayStr(offset: number): string {
    const d = new Date()
    d.setDate(d.getDate() - offset)
    return d.toISOString().slice(0, 10)
}

// ── 工具：带噪声的线性增长 ────────────────────────────────────────────────────────
function trend(base: number, growth: number, day: number, noise: number): number {
    const val = base + growth * day + (Math.random() * 2 - 1) * noise
    return Math.max(0, Math.round(val))
}

// ── 生成过去 60 天的指标数据 ──────────────────────────────────────────────────────
function generateItems(
    projectId: number,
    startIdBase: number,
    configs: { name: string; base: number; growth: number; noise: number }[],
    days: number,
): {
    id: number
    projectId: number
    day: string
    name: string
    value: number
    createdAt: string
    updatedAt: string
}[] {
    const items: { id: number; projectId: number; day: string; name: string; value: number; createdAt: string; updatedAt: string }[] = []
    let nextId = startIdBase
    const ts = daysAgo(0)
    for (let d = days - 1; d >= 0; d--) {
        const day = dayStr(d)
        for (const cfg of configs) {
            items.push({
                id: nextId++,
                projectId,
                day,
                name: cfg.name,
                value: trend(cfg.base, cfg.growth, days - 1 - d, cfg.noise),
                createdAt: ts,
                updatedAt: ts,
            })
        }
    }
    return items
}

const proj1Items = generateItems(1, 10001, [
    { name: 'pv',        base: 1200, growth: 28, noise: 150 },
    { name: 'income',    base: 300,  growth: 18, noise: 80  },
    { name: 'refund',    base: 20,   growth: 0.3,noise: 10  },
    { name: 'userCount', base: 420,  growth: 10, noise: 40  },
    { name: 'dau',       base: 180,  growth: 5,  noise: 25  },
], 60)

const proj2Items = generateItems(2, 20001, [
    { name: 'pv',        base: 300,  growth: 22, noise: 60 },
    { name: 'income',    base: 0,    growth: 8,  noise: 20 },
    { name: 'refund',    base: 0,    growth: 0.1,noise: 3  },
    { name: 'userCount', base: 50,   growth: 6,  noise: 15 },
    { name: 'dau',       base: 30,   growth: 3,  noise: 10 },
], 30)

const proj3Items = generateItems(3, 30001, [
    { name: 'pv',        base: 800,  growth: 35, noise: 120 },
    { name: 'income',    base: 12,   growth: 0.8,noise: 5   },
    { name: 'userCount', base: 300,  growth: 20, noise: 50  },
    { name: 'newsletter',base: 80,   growth: 8,  noise: 12  },
    { name: 'reactions', base: 40,   growth: 4,  noise: 8   },
], 47)

const proj6Items = generateItems(6, 60001, [
    { name: 'topicCount',    base: 20,  growth: 8,   noise: 3  },
    { name: 'templateCount', base: 0,   growth: 0.5, noise: 0  },
    { name: 'monthsPlanned', base: 0,   growth: 0.3, noise: 0  },
    { name: 'platformCount', base: 2,   growth: 0.2, noise: 0  },
    { name: 'contentGoal',   base: 200, growth: 2,   noise: 5  },
], 3)

export const metricItems = [...proj1Items, ...proj2Items, ...proj3Items, ...proj6Items]
