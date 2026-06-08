export const fileTree = [
    {
        name: 'memory', path: '/memory', type: 'dir',
        children: [
            {
                name: 'global', path: '/memory/global', type: 'dir', children: [
                    { name: 'brand_guidelines.md', path: '/memory/global/brand_guidelines.md', type: 'file', size: 3072, mtime: Date.now() - 86400000 },
                    { name: 'seo_keywords.json', path: '/memory/global/seo_keywords.json', type: 'file', size: 6144, mtime: Date.now() - 172800000 },
                    { name: 'tone_of_voice.md', path: '/memory/global/tone_of_voice.md', type: 'file', size: 2048, mtime: Date.now() - 259200000 },
                ],
            },
            {
                name: 'agent', path: '/memory/agent', type: 'dir', children: [
                    { name: 'growth_strategist_notes.md', path: '/memory/agent/growth_strategist_notes.md', type: 'file', size: 2048, mtime: Date.now() - 3600000 },
                    { name: 'seo_keyword_cache.json', path: '/memory/agent/seo_keyword_cache.json', type: 'file', size: 12288, mtime: Date.now() - 7200000 },
                    { name: 'competitor_analysis.md', path: '/memory/agent/competitor_analysis.md', type: 'file', size: 4096, mtime: Date.now() - 14400000 },
                ],
            },
        ],
    },
    {
        name: 'skills', path: '/skills', type: 'dir',
        children: [
            {
                name: 'seo-writer', path: '/skills/seo-writer', type: 'dir', children: [
                    { name: 'SKILL.md', path: '/skills/seo-writer/SKILL.md', type: 'file', size: 4096, mtime: Date.now() - 604800000 },
                ],
            },
            {
                name: 'overseas-content', path: '/skills/overseas-content', type: 'dir', children: [
                    { name: 'SKILL.md', path: '/skills/overseas-content/SKILL.md', type: 'file', size: 3584, mtime: Date.now() - 432000000 },
                ],
            },
        ],
    },
    {
        name: 'logs', path: '/logs', type: 'dir',
        children: [
            { name: 'agent-2026-03-01.log', path: '/logs/agent-2026-03-01.log', type: 'file', size: 98304, mtime: Date.now() - 86400000 },
            { name: 'agent-2026-03-02.log', path: '/logs/agent-2026-03-02.log', type: 'file', size: 45056, mtime: Date.now() - 1800000 },
        ],
    },
]

export const databases = [
    { name: 'clawgoal.db', path: '/data/clawgoal.db', size: 8388608 },
    { name: 'analytics.db', path: '/data/analytics.db', size: 2097152 },
]
