/** user_param 表 MySQL DDL */
export function createParam(): string {
  return `CREATE TABLE IF NOT EXISTS \`user_param\` (
    \`id\`         BIGINT       NOT NULL AUTO_INCREMENT,
    \`user_id\`    BIGINT       NOT NULL,
    \`name\`       VARCHAR(200) NOT NULL,
    \`value\`      TEXT         NOT NULL,
    \`scope\`      VARCHAR(100) NOT NULL DEFAULT '',
    \`remark\`     TEXT         NOT NULL DEFAULT '',
    \`created_at\` DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    \`updated_at\` DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY \`user_param_user_id_name_key\` (\`user_id\`, \`name\`),
    PRIMARY KEY (\`id\`)
  ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
}
