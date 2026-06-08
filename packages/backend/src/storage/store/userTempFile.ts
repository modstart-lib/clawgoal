import { getSharedDb } from '../sqlite.js'
import { SqliteUserTempFileStore } from '../sqlite/store/userTempFile.js'

export interface UserTempFileRow {
  id: number
  tenantId: number
  userId: number
  path: string
  ext: string
  localPath: string
  expireAt: Date
  createdAt: Date
  updatedAt: Date
}

export interface CreateUserTempFileInput {
  tenantId: number
  userId: number
  path: string
  ext: string
  localPath: string
  expireAt: Date
}

export interface IUserTempFileStore {
  open(): Promise<void>
  create(input: CreateUserTempFileInput): Promise<UserTempFileRow>
  findByPath(path: string): Promise<UserTempFileRow | null>
  deleteExpired(): Promise<number>
  deleteByPath(path: string): Promise<void>
}

class UserTempFileDb implements IUserTempFileStore {
  private store: SqliteUserTempFileStore | null = null

  private get s(): SqliteUserTempFileStore {
    if (!this.store) throw new Error('userTempFileDb not opened')
    return this.store
  }

  async open(): Promise<void> {
    this.store = new SqliteUserTempFileStore(getSharedDb())
  }

  create(input: CreateUserTempFileInput): Promise<UserTempFileRow> {
    return this.s.create(input)
  }

  findByPath(path: string): Promise<UserTempFileRow | null> {
    return this.s.findByPath(path)
  }

  deleteExpired(): Promise<number> {
    return this.s.deleteExpired()
  }

  deleteByPath(path: string): Promise<void> {
    return this.s.deleteByPath(path)
  }
}

export const userTempFileDb = new UserTempFileDb()
