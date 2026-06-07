// 固定随机种子伪随机，保证每次 mock 数据一致
const seededRand = (seed: number) => {
    let s = seed
    return () => {
        s = (s * 1664525 + 1013904223) & 0xffffffff
        return (s >>> 0) / 0xffffffff
    }
}

const generateDailyStats = () => {
    const stats = []
    const models = [
        {
            provider: 'openai', model: 'gpt-4o',
            // gpt-4o：主力模型，调用量最高，有稳定增长趋势
            baseCalls: 1480, growth: 0.018,
            promptRatio: 9200, completionRatio: 14200,
            avgDuration: 3180,
        },
        {
            provider: 'anthropic', model: 'claude-3-5-sonnet-20241022',
            // claude：高质量写作专用，调用量平稳略有上升
            baseCalls: 1120, growth: 0.012,
            promptRatio: 10500, completionRatio: 16800,
            avgDuration: 2740,
        },
        {
            provider: 'openai', model: 'gpt-4o-mini',
            // mini：补丁/摘要任务，近期快速增长
            baseCalls: 640, growth: 0.032,
            promptRatio: 4800, completionRatio: 7200,
            avgDuration: 980,
        },
        {
            provider: 'deepseek', model: 'deepseek-chat',
            // deepseek：成本敏感场景，中期爆发增长后趋于平稳
            baseCalls: 880, growth: 0.025,
            promptRatio: 8600, completionRatio: 12400,
            avgDuration: 1680,
        },
    ]

    const rand = seededRand(42)

    for (let i = 29; i >= 0; i--) {
        const date = new Date(Date.now() - i * 86400000)
        const dateStr = date.toISOString().split('T')[0]
        const dayOfWeek = date.getDay() // 0=Sun, 6=Sat
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6
        // 周末流量下降约 35%
        const weekendFactor = isWeekend ? 0.65 : 1.0
        // 最近一周额外 spike（模拟新功能上线）
        const spikeFactor = i < 7 ? 1.18 : 1.0

        for (const m of models) {
            // 增长趋势：越早的日期调用量越少，growth 控制增速
            const growthFactor = 1 + m.growth * (29 - i)
            // 正弦波动：模拟周期性业务节奏（约 7 天一个周期）
            const sinWave = 1 + 0.08 * Math.sin((2 * Math.PI * (29 - i)) / 7)
            // 随机噪声 ±12%
            const noise = 1 + (rand() - 0.5) * 0.24
            const calls = Math.max(5, Math.round(m.baseCalls * growthFactor * weekendFactor * spikeFactor * sinWave * noise))

            // token 数也加入随机波动
            const tokenNoise = 0.9 + rand() * 0.2
            const promptTokens = Math.round(calls * m.promptRatio * tokenNoise)
            const completionTokens = Math.round(calls * m.completionRatio * tokenNoise)

            stats.push({
                date: dateStr,
                provider: m.provider,
                model: m.model,
                call_count: calls,
                total_prompt_tokens: promptTokens,
                total_completion_tokens: completionTokens,
                total_tokens: promptTokens + completionTokens,
            })
        }
    }
    return stats
}

// 根据 dailyStats 聚合出总的 modelStats
const generateModelStats = () => {
    const map: Record<string, {
        provider: string; model: string; call_count: number
        total_prompt_tokens: number; total_completion_tokens: number; total_tokens: number
        avg_duration_ms: number; error_count: number
    }> = {}
    const durations: Record<string, number> = {
        'gpt-4o': 3180, 'claude-3-5-sonnet-20241022': 2740, 'gpt-4o-mini': 980, 'deepseek-chat': 1680,
    }
    for (const r of dailyStats) {
        const key = `${r.provider}|${r.model}`
        if (!map[key]) {
            map[key] = {
                provider: r.provider, model: r.model,
                call_count: 0, total_prompt_tokens: 0,
                total_completion_tokens: 0, total_tokens: 0,
                avg_duration_ms: durations[r.model] || 2000,
                error_count: 0,
            }
        }
        map[key].call_count += r.call_count
        map[key].total_prompt_tokens += r.total_prompt_tokens
        map[key].total_completion_tokens += r.total_completion_tokens
        map[key].total_tokens += r.total_tokens
    }
    // error_count 按调用量约 0.4% 估算
    return Object.values(map).map(v => ({ ...v, error_count: Math.round(v.call_count * 0.004) }))
}

export const dailyStats = generateDailyStats()
export const modelStats = generateModelStats()

export const modelProviders = [
    {
        name: 'openai-main',
        provider: 'openai',
        apiBase: 'https://api.openai.com/v1',
        apiKey: 'sk-****************************',
        isDefault: true,
        defaultModel: 'gpt-4o',
        models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo'],
    },
    {
        name: 'anthropic-main',
        provider: 'anthropic',
        apiBase: 'https://api.anthropic.com',
        apiKey: 'sk-ant-****************************',
        isDefault: false,
        defaultModel: 'claude-3-5-sonnet-20241022',
        models: ['claude-3-5-sonnet-20241022', 'claude-3-haiku-20240307'],
    },
    {
        name: 'deepseek-main',
        provider: 'deepseek',
        apiBase: 'https://api.deepseek.com/v1',
        apiKey: 'sk-ds-****************************',
        isDefault: false,
        defaultModel: 'deepseek-chat',
        models: ['deepseek-chat', 'deepseek-reasoner'],
    },
]
