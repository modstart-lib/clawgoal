/**
 * 基础模块 demo seed — api_token 演示数据
 */
import { config } from '../../../config/index.js'
import { apiTokenDb } from '../../store/apiToken.js'

const TEST_USER_ID = config.supervisorUserId

export async function createBaseDemoData(): Promise<void> {
  const tokens = [
    {
      token: 'demo-token-read-' + Math.random().toString(36).slice(2, 10),
      permissions: 'system/stats,setting/get,apiToken/paginate',
      expire: new Date('2027-12-31 23:59:59'),
      title: '演示只读 Token',
    },
    {
      token: 'demo-token-write-' + Math.random().toString(36).slice(2, 10),
      permissions:
        'system/stats,setting/get,setting/set,apiToken/paginate,apiToken/add',
      expire: new Date('2027-06-30 23:59:59'),
      title: '演示读写 Token',
    },
    {
      token: 'demo-token-admin-' + Math.random().toString(36).slice(2, 10),
      permissions: '*',
      expire: new Date('2026-12-31 23:59:59'),
      title: '演示全限 Token',
    },
  ]

  for (const t of tokens) {
    await apiTokenDb.createApiToken({
      userId: TEST_USER_ID,
      tenantId: 1,
      token: t.token,
      permissions: t.permissions,
      expire: t.expire,
      title: t.title,
    })
  }
}
