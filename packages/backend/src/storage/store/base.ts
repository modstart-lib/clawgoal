/**
 * 公共基础存储层
 * 包含跨模块共用的类型定义、接口和 settingDb 单例。
 */

// ─── Setting ──────────────────────────────────────────────────────────────────

export interface SettingRow {
  id: number
  name: string
  value: string
  createdAt: Date
  updatedAt: Date
}

// ─── Paginate ─────────────────────────────────────────────────────────────────

export interface PaginateResult<T> {
  data: T[]
  page: number
  pageSize: number
  total: number
  totalPages: number
}

// ─── ISettingStore ────────────────────────────────────────────────────────────

export interface ISettingStore {
  getSetting(name: string): Promise<SettingRow | null>
  upsertSetting(name: string, value: string): Promise<void>
  getManySettings(names: string[]): Promise<SettingRow[]>
}

// ─── IParamStore ──────────────────────────────────────────────────────────────

export interface ParamRow {
  name: string
  value: string
  scope: string
  remark: string
}

export interface IParamStore {
  getParam(
    tenantId: number,
    userId: number,
    name: string
  ): Promise<string | null>
  setParam(
    tenantId: number,
    userId: number,
    name: string,
    value: string,
    scope?: string,
    remark?: string
  ): Promise<void>
  deleteParam(tenantId: number, userId: number, name: string): Promise<void>
  findParamByNameAndValue(
    name: string,
    value: string
  ): Promise<{ tenantId: number; userId: number } | null>
  listByPrefix(
    tenantId: number,
    userId: number,
    prefix: string
  ): Promise<ParamRow[]>
}

// ─── ApiToken ─────────────────────────────────────────────────────────────────

export interface ApiTokenRow {
  id: number
  tenantId: number
  userId: number
  token: string
  permissions: string
  expire: Date
  title: string | null
  lastUseTime: Date | null
  createdAt: Date
  updatedAt: Date
}

export interface CreateApiTokenInput {
  tenantId: number
  userId: number
  token: string
  permissions: string
  expire: Date
  title?: string | null
}

export interface UpdateApiTokenInput {
  token?: string
  permissions?: string
  expire?: Date
  title?: string | null
  lastUseTime?: Date | null
}

export interface IApiTokenStore {
  findAllApiTokens(tenantId: number, userId: number): Promise<ApiTokenRow[]>
  paginateApiTokens(
    tenantId: number,
    userId: number,
    page: number,
    pageSize: number
  ): Promise<PaginateResult<ApiTokenRow>>
  findApiTokenById(id: number): Promise<ApiTokenRow | null>
  findApiTokenByToken(token: string): Promise<ApiTokenRow | null>
  createApiToken(data: CreateApiTokenInput): Promise<ApiTokenRow>
  updateApiToken(id: number, data: UpdateApiTokenInput): Promise<ApiTokenRow>
  deleteApiToken(id: number): Promise<void>
}

// ─── settingDb 单例 ────────────────────────────────────────────────────────────

function _dbProvider(): 'sqlite' | 'mysql' {
  const p = (process.env.DATABASE_PROVIDER ?? 'sqlite').toLowerCase()
  return p === 'mysql' ? 'mysql' : 'sqlite'
}

let _settingStore: ISettingStore | null = null

async function _getSettingStore(): Promise<ISettingStore> {
  if (!_settingStore) {
    if (_dbProvider() === 'mysql') {
      const { MysqlSettingStore } = await import('../mysql/store/setting.js')
      _settingStore = new MysqlSettingStore()
    } else {
      const { SqliteSettingStore } = await import('../sqlite/store/setting.js')
      _settingStore = new SqliteSettingStore()
    }
  }
  return _settingStore
}

/** 全局 setting 存储单例（mysql2 仅在 DATABASE_PROVIDER=mysql 时才会被加载） */
export const settingDb: ISettingStore = {
  async getSetting(name) {
    return (await _getSettingStore()).getSetting(name)
  },
  async upsertSetting(name, value) {
    return (await _getSettingStore()).upsertSetting(name, value)
  },
  async getManySettings(names) {
    return (await _getSettingStore()).getManySettings(names)
  },
}
