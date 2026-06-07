export const AppConfig = {
  /** 应用标识（小写，用于 localStorage key 前缀等） */
  name: 'clawgoal',
  /** 应用展示名称 */
  title: 'ClawGoal',
  /** 应用描述 */
  description: 'Agents Go for Goals',
  /** 应用版本 */
  version: `v${__APP_VERSION__}`, // 由 vite.config.ts 从 package.json 注入
  /** 构建时间 */
  buildTime: __BUILD_TIME__, // 由 vite.config.ts 在构建时注入

  // ─── URL 配置 ──────────────────────────────────────────────────────────
  /** 外部站点基础 URL */
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

  /** localStorage / sessionStorage Key 常量 */
  storageKeys: {
    /** 登录 Token */
    token: 'auth_token',
    /** 当前登录用户 ID */
    userId: 'user_id',
    /** 界面语言 */
    locale: 'locale',
    /** 深色 / 浅色主题 */
    theme: 'theme',
    /** 侧边栏折叠状态 */
    sidebarCollapsed: 'sidebar_collapsed',
    /** 侧边栏激活类型（仅 all 模式）*/
    sidebarActiveType: 'sidebar_active_type',
    /** 第三方用户 Token */
    userToken: 'user_token',
    /** 第三方用户 ID */
    userMemberId: 'user_member_id',
    /** 第三方用户名 */
    userName: 'user_name',
    /** 第三方用户头像 */
    userAvatar: 'user_avatar',
    /** 第三方用户完整数据（JSON） */
    userApiData: 'user_api_data',
  },
}
