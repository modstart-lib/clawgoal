import { now } from '../../../../../backend/src/storage/seed/util'

export const runtimes = [
    {
        id: 1,
        name: 'macbook-pro',
        title: '主力笔记本',
        token: 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6',
        status: 'online',
        active_at: new Date(Date.now() - 3 * 60 * 1000).toISOString(),
        created_at: now(),
        updated_at: now(),
    },
    {
        id: 2,
        name: 'home-server',
        title: '家庭服务器',
        token: 'b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1',
        status: 'online',
        active_at: new Date(Date.now() - 12 * 60 * 1000).toISOString(),
        created_at: now(),
        updated_at: now(),
    },
    {
        id: 3,
        name: 'cloud-vps',
        title: '云端 VPS',
        token: 'c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2',
        status: 'offline',
        active_at: new Date(Date.now() - 2 * 3600 * 1000).toISOString(),
        created_at: now(),
        updated_at: now(),
    },
    {
        id: 4,
        name: 'office-desktop',
        title: '办公室台式机',
        token: 'd4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3',
        status: 'offline',
        active_at: null,
        created_at: now(),
        updated_at: now(),
    },
]
