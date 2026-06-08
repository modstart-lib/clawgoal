import { now } from '../../../../../backend/src/storage/seed/util'

export const mcps = [
    {
        id: 1,
        name: 'playwright',
        title: 'Playwright MCP',
        type: 'stdio',
        enable: 1,
        config: JSON.stringify({
            command: 'npx',
            args: ['-y', '@playwright/mcp@latest'],
            env: { HEADLESS: 'false' },
        }),
        status: 'disconnected',
        description: 'Playwright 浏览器自动化',
        createdAt: now(),
    },
]
