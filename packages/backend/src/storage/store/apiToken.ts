import type { IApiTokenStore } from './base.js'
export type {
  ApiTokenRow,
  CreateApiTokenInput,
  IApiTokenStore,
  PaginateResult,
  UpdateApiTokenInput,
} from './base.js'

function dbProvider(): 'sqlite' | 'mysql' {
  const p = (process.env.DATABASE_PROVIDER ?? 'sqlite').toLowerCase()
  return p === 'mysql' ? 'mysql' : 'sqlite'
}

let _store: IApiTokenStore | null = null

/** 全局 apiToken 存储单例（mysql2 仅在 DATABASE_PROVIDER=mysql 时才会被加载） */
export const apiTokenDb: IApiTokenStore & { open(): Promise<void> } = {
  async open() {
    if (dbProvider() === 'mysql') {
      const { MysqlApiTokenStore } = await import('../mysql/store/apiToken.js')
      const inst = new MysqlApiTokenStore()
      await inst.open()
      _store = inst
    } else {
      const { SqliteApiTokenStore } =
        await import('../sqlite/store/apiToken.js')
      const inst = new SqliteApiTokenStore()
      await inst.open()
      _store = inst
    }
  },
  findAllApiTokens(tenantId, userId) {
    return _store!.findAllApiTokens(tenantId, userId)
  },
  paginateApiTokens(tenantId, userId, page, pageSize) {
    return _store!.paginateApiTokens(tenantId, userId, page, pageSize)
  },
  findApiTokenById(id) {
    return _store!.findApiTokenById(id)
  },
  findApiTokenByToken(token) {
    return _store!.findApiTokenByToken(token)
  },
  createApiToken(data) {
    return _store!.createApiToken(data)
  },
  updateApiToken(id, data) {
    return _store!.updateApiToken(id, data)
  },
  deleteApiToken(id) {
    return _store!.deleteApiToken(id)
  },
}
