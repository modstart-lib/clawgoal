import packageJson from '../package.json' with { type: 'json' }

export const AppConfig = {
  /** 应用标识（小写，用于 localStorage key 前缀等） */
  name: 'clawgoal',
  /** 应用展示名称 */
  title: 'ClawGoal',
  /** 应用版本号 */
  version: packageJson.version || '1.0.0',
  /** 应用类型：open（开源版）/ pro（商业版） */
  type: 'open',

  // ─── URL 配置 ──────────────────────────────────────────────────────────
  /** 外部站点基础 URL，可在 config.yaml 中通过 baseUrl 字段配置 */
  baseUrl: 'https://clawgoal.com',
  /** 官网地址 */
  website: 'https://clawgoal.com',
  /** GitHub */
  websiteGithub: 'https://github.com/modstart-lib/clawgoal',
  /** Gitee */
  websiteGitee: 'https://gitee.com/modstart-lib/clawgoal',
  /** API 基础地址 */
  apiBaseUrl: 'https://clawgoal.com/api',
  /** 数据采集 */
  analyticsUrl: 'https://clawgoal.com/app_manager/collect',
  /** 版本检查 */
  versionCheckUrl: 'https://clawgoal.com/app_manager/updater',
  /** 反馈入口 */
  feedbackUrl: 'https://clawgoal.com/feedback_ticket',
  /** 使用指南 */
  guideUrl: 'https://clawgoal.com/app_manager/guide',
  /** 帮助文档 */
  helpUrl: 'https://clawgoal.com/app_manager/help',
}


export * from './config/index'
