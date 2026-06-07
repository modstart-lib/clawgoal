/** data / data_chunk 表 DDL — 用于向量数据库 */
export function createEmbeddingSchema(): string {
  return `
CREATE TABLE IF NOT EXISTS data (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  scope       TEXT    NOT NULL UNIQUE,
  content_md5 TEXT    NOT NULL,
  content     TEXT    NOT NULL,
  config      TEXT    NOT NULL DEFAULT '{}',
  created_at  TEXT    NOT NULL DEFAULT (datetime('now','localtime')),
  updated_at  TEXT    NOT NULL DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS data_chunk (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  scope      TEXT    NOT NULL REFERENCES data(scope) ON DELETE CASCADE,
  seq        INTEGER NOT NULL,
  content    TEXT    NOT NULL,
  embedding  BLOB    NOT NULL,
  created_at TEXT    NOT NULL DEFAULT (datetime('now','localtime')),
  updated_at TEXT    NOT NULL DEFAULT (datetime('now','localtime')),
  UNIQUE(scope, seq)
);

CREATE INDEX IF NOT EXISTS idx_data_chunk_scope ON data_chunk(scope);
`
}
