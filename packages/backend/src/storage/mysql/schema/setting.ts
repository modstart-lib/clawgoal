/** setting 表 MySQL DDL */
export function createSetting(): string {
  return `CREATE TABLE IF NOT EXISTS \`setting\` (
    \`id\`         INT          NOT NULL AUTO_INCREMENT,
    \`name\`       VARCHAR(200) NOT NULL,
    \`value\`      TEXT         NOT NULL,
    \`created_at\` DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    \`updated_at\` DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY \`setting_name_key\` (\`name\`),
    PRIMARY KEY (\`id\`)
  ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
}
