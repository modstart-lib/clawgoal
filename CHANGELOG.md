# Changelog


## [Unreleased]

### 新增
- **Event/Note 分享**：后端分享接口返回完整 `shareUrl`（基于 `config.url` 构建），前端分享功能直接返回完整链接，无需手动拼接

### 优化
- **Event API 拆分**：将 Event 相关接口（`addEvent`、`editEvent`、`deleteEvent`、`listEvents`、`shareEvent` 等）从 `project.ts` 提取到独立的 `event.ts` 文件，各组件更新导入路径
- **API 文档完善**：为 agentSession、memory、task、mock、auth、config、settingModelLog 等模块补充和更新 `@ReturnDataExample` 注解，新增 `/claw/task/stats` 接口文档声明
- **登录接口返回增强**：登录 / 自动登录 / 刷新令牌接口返回值新增 `tenantId` 字段
- **模型用量统计优化**：`logBizValues`、`stats`、`dailyStats`、`hourlyStats` 接口返回值增加 `callCount`、`total(Prompt/Completion)Tokens`、`errorCount`、`avgDurationMs` 等详细字段

### 新增
- **Wiki 数据模型扩展**：`WikiRow` 及输入类型新增 `biz`（业务类型）、`meta`（元数据）字段，提升数据扩展性

---

## [0.1.0] - 2026-05-20

### 新增
- **OKR 目标管理**：支持 Objective（目标）与 Key Result（关键结果）的创建、编辑、删除，AI 自动生成目标建议与关键结果分解，进度跟踪与指标关联
- **项目管理**：项目全生命周期管理（规划/进行中/暂停/完成/归档），8 个详情标签页（概览、待办、目标、任务、笔记、事件、指标、Wiki、成员、管理），AI 智能摘要
- **任务管理**：层级任务树（父/子/根任务），状态流转 `draft → queue → pending → ready → asking → running → success/failed/canceled`，AI 批量生成与建议，看板式待办面板
- **AI 智能体系统**：多智能体管理（CRUD），内置角色模板（含"嬴政"超级管理员角色），实时 WebSocket 聊天，文件/图片附件，模型/工具/技能/MCP 配置，记忆系统（时间桶摘要 + 语义搜索），变更审核（Diff 对比 + 审批流）
- **LangGraph 工作流引擎**：YAML 定义有向图，支持 6 种节点类型（AgentModel、AgentRouter、AgentTool、AgentSubgraph、AgentCode、ContextRouter），暂停/恢复执行，自动流水线编排
- **LLM 模型系统**：多厂商支持（OpenAI、Anthropic Claude、Google Gemini、Ollama 及兼容 API），内置云端代理，命名别名与回退链，嵌入模型（sqlite-vec / OpenAI），用量监控与统计
- **80+ 内置工具**：文件 I/O、Shell/Python 执行、网络搜索与抓取、记忆读写、OKR/任务/项目 CRUD、事件/指标/笔记/Wiki 管理、定时任务、智能体调用、运行时工具、MCP 动态路由
- **10 个消息渠道**：Telegram、飞书、钉钉、企业微信、Discord、Slack、Microsoft Teams、LINE、Matrix、Mattermost，统一 Webhook 路由与签名验证，渠道健康监控
- **MCP 协议集成**：支持 stdio / SSE / Streamable HTTP 三种连接方式，自动重连，工具动态注册为 `mcp_{serverName}_{toolName}`
- **定时任务系统**：Cron 任务管理（启用/禁用/手动触发），Shell 命令执行（流式日志）与智能体调度两种模式，AI 执行摘要，历史日志查看
- **外部 Runner 集成**：支持 Codex CLI、Claude Code、OpenCode、Gemini CLI、GitHub Copilot、Aider、Cursor 等工具，自动发现已安装 CLI，远程运行时管理
- **知识管理**：Wiki 完整 CRUD + Markdown 编辑 + 批量 URL/路径同步；笔记富文本/Markdown + 分类 + 哈希链接分享；技能系统（Markdown + YAML frontmatter）
- **3D 虚拟办公室**：Babylon.js 驱动的 3D 场景，Minecraft 风格方块头像，NPC 自主行为（办公/走动/举手/气泡对话），A* 寻路与避障，鼠标交互，办公室家具与城市天际线
- **资源管理**：本地/远程运行时（Python 检测），MCP 服务器连接管理，技能注册浏览，操作系统实时监控（CPU/内存/磁盘）
- **工作流可视化编辑器**：基于 LogicFlow 的拖拽式工作流设计器，16 种节点类型（LLM、条件判断、JS 执行、变量、文件操作、MCP 调用、HTTP 请求等）
- **配置与设置**：模型提供商配置、嵌入模型选择、存储后端（本地/阿里云OSS/腾讯COS/七牛/AWS S3/Azure Blob/ModStart）、代理设置、认证模式（固定用户/多用户）、通知渠道、语言主题时区、数据库管理、文件浏览器、用量分析、自动备份
- **认证与用户系统**：滑动拼图验证码登录，JWT 自动刷新，API 令牌管理，多用户管理，远程用户 SSO
- **Electron 桌面应用**：后端 + 前端打包为原生桌面应用，启动向导（新装/恢复），自动端口发现，健康轮询，优雅关闭，macOS/Windows/Linux 三端打包
- **国际化**：完整的中文（zh-CN）与英文（en-US）双语支持，前后端统一 i18n
- **项目工程化**：pnpm monorepo 架构，TypeScript 全栈，Vitest 单元测试，Playwright E2E 测试，GitHub Actions CI/CD，ESLint + Prettier 代码规范
