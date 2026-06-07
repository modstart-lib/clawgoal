/** notice / notice_log 表 MySQL DDL */
export function createNotice(): string {
  return `CREATE TABLE IF NOT EXISTS \`notice\` (
    \`id\`                BIGINT       NOT NULL AUTO_INCREMENT,
    \`user_id\`           BIGINT       NOT NULL,
    \`title\`             VARCHAR(500) NOT NULL,
    \`enable\`            TINYINT(1)   NOT NULL DEFAULT 1,
    \`rate_limit_enable\` TINYINT(1)   NOT NULL DEFAULT 0,
    \`rate_interval\`     INT          NOT NULL DEFAULT 60,
    \`type\`              VARCHAR(50)  NOT NULL,
    \`config\`            TEXT         NOT NULL DEFAULT '{}',
    \`proxy_name\`        VARCHAR(200) NULL,
    \`created_at\`        DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    \`updated_at\`        DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX \`notice_user_id_idx\` (\`user_id\`),
    PRIMARY KEY (\`id\`)
  ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
}

export function createNoticeLog(): string {
  return `CREATE TABLE IF NOT EXISTS \`notice_log\` (
    \`id\`         BIGINT       NOT NULL AUTO_INCREMENT,
    \`user_id\`    BIGINT       NOT NULL,
    \`notice_id\`  BIGINT       NOT NULL,
    \`title\`      VARCHAR(500) NOT NULL DEFAULT '',
    \`content\`    TEXT         NOT NULL DEFAULT '',
    \`status\`     VARCHAR(20)  NOT NULL DEFAULT 'success',
    \`created_at\` DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    \`updated_at\` DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX \`notice_log_user_id_idx\` (\`user_id\`),
    INDEX \`notice_log_notice_id_idx\` (\`notice_id\`),
    PRIMARY KEY (\`id\`)
  ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
}
