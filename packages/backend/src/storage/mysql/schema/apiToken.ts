/** api_token 表 MySQL DDL */
export function createApiToken(): string {
  return `CREATE TABLE IF NOT EXISTS \`api_token\` (
    \`id\`          BIGINT        NOT NULL AUTO_INCREMENT,
    \`user_id\`     BIGINT        NOT NULL,
    \`token\`       VARCHAR(200)  NOT NULL,
    \`permissions\` TEXT          NOT NULL DEFAULT '',
    \`expire\`      DATETIME      NOT NULL,
    \`title\`       VARCHAR(500)  NULL,
    \`last_use_time\` DATETIME     NULL,
    \`created_at\`  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    \`updated_at\`  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY \`api_token_token_key\` (\`token\`),
    INDEX \`api_token_user_id_idx\` (\`user_id\`),
    PRIMARY KEY (\`id\`)
  ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
}
