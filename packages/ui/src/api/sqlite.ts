import apiClient from './client'

export interface DbFile {
  name: string
  path: string
  size: number
}

export interface DbTable {
  name: string
  count: number
  size: number
}

export interface DbColumn {
  cid: number
  name: string
  type: string
  notnull: number
  dflt_value: any
  pk: number
}

export interface DbRowsResult {
  rows: Record<string, any>[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

export const listDatabases = async (): Promise<DbFile[]> => {
  const res = await apiClient.post('/setting/sqlite/list')
  return res.data.data || []
}

export const listTables = async (dbPath: string): Promise<DbTable[]> => {
  const res = await apiClient.post('/setting/sqlite/tables', { dbPath })
  return res.data.data || []
}

export const getTableSchema = async (
  dbPath: string,
  table: string
): Promise<DbColumn[]> => {
  const res = await apiClient.post('/setting/sqlite/schema', { dbPath, table })
  return res.data.data || []
}

export const getTableRows = async (
  dbPath: string,
  table: string,
  page = 1,
  pageSize = 20
): Promise<DbRowsResult> => {
  const res = await apiClient.post('/setting/sqlite/rows', {
    dbPath,
    table,
    page,
    pageSize,
  })
  return res.data.data
}

export const deleteRow = async (
  dbPath: string,
  table: string,
  pkColumn: string,
  pkValue: any
): Promise<void> => {
  await apiClient.post('/setting/sqlite/deleteRow', {
    dbPath,
    table,
    pkColumn,
    pkValue,
  })
}

export const updateRow = async (
  dbPath: string,
  table: string,
  pkColumn: string,
  pkValue: any,
  data: Record<string, any>
): Promise<void> => {
  await apiClient.post('/setting/sqlite/updateRow', {
    dbPath,
    table,
    pkColumn,
    pkValue,
    data,
  })
}

export interface DbExecuteResult {
  rows: Record<string, any>[] | null
  affected: number | null
}

export const executeSQL = async (
  dbPath: string,
  sql: string
): Promise<DbExecuteResult> => {
  const res = await apiClient.post('/setting/sqlite/execute', { dbPath, sql })
  return res.data.data
}
