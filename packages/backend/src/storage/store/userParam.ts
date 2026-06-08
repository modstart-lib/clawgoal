import type { IParamStore, ParamRow } from './base.js'

export type { IParamStore, ParamRow }

function dbProvider(): 'sqlite' | 'mysql' {
  const p = (process.env.DATABASE_PROVIDER ?? 'sqlite').toLowerCase()
  return p === 'mysql' ? 'mysql' : 'sqlite'
}

let _store: IParamStore | null = null

/** 全局 param 存储单例（mysql2 仅在 DATABASE_PROVIDER=mysql 时才会被加载） */
export const paramDb: IParamStore & { open(): Promise<void> } = {
  async open() {
    if (dbProvider() === 'mysql') {
      const { MysqlParamStore } = await import('../mysql/store/userParam.js')
      const inst = new MysqlParamStore()
      await inst.open()
      _store = inst
    } else {
      const { SqliteParamStore } = await import('../sqlite/store/userParam.js')
      const inst = new SqliteParamStore()
      inst.open()
      _store = inst
    }
  },
  getParam(tenantId, userId, name) {
    return _store!.getParam(tenantId, userId, name)
  },
  setParam(tenantId, userId, name, value, scope, remark) {
    return _store!.setParam(tenantId, userId, name, value, scope, remark)
  },
  deleteParam(tenantId, userId, name) {
    return _store!.deleteParam(tenantId, userId, name)
  },
  findParamByNameAndValue(name, value) {
    return _store!.findParamByNameAndValue(name, value)
  },
  listByPrefix(tenantId, userId, prefix) {
    return _store!.listByPrefix(tenantId, userId, prefix)
  },
}
