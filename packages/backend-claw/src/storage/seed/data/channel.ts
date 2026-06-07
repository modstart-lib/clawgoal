import { daysAgo } from '../../../../../backend/src/storage/seed/util'

export const channels = [
    {
        id: 1,
        title: 'Telegram 主渠道',
        type: 'telegram',
        enable: false,
        isGlobal: true,
        status: 'success',
        config: { token: '123456:ABCxxx', chatId: '-100123456789', ownerId: '88888888' },
        createdAt: daysAgo(30),
    },
    {
        id: 2,
        title: '飞书 运营群',
        type: 'feishu',
        enable: false,
        isGlobal: false,
        status: 'success',
        config: { token: 'feishu-token-xxx', chatId: 'oc_abcdef123456', ownerId: '' },
        createdAt: daysAgo(20),
    },
    {
        id: 3,
        title: 'Telegram 测试渠道',
        type: 'telegram',
        enable: false,
        isGlobal: false,
        status: 'pending',
        config: { token: '999999:TESTxxx', chatId: '', ownerId: '' },
        createdAt: daysAgo(5),
    },
]
