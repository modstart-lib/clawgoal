# ClawGoal

[简体中文](README.zh-CN.md) | [English](README.md)

> 基于目标与 OKR 的 AI Agent 工作台，让 AI 围绕清晰目标、有序计划和可追踪任务持续推进。🚀

ClawGoal 是一个面向个人、团队和自动化运营场景的目标管理型 AI 工作空间。它以 OKR 为核心，把目标、关键结果、项目、任务、知识库、自动化和多智能体协作串成一条清晰的执行链路，让 AI 不再只是临时回答问题，而是围绕明确目标持续拆解、执行、复盘和沉淀。

项目采用 Monorepo 组织，包含 Web UI、后端服务、Claw Agent 模块以及 Wails 桌面客户端。

## 🖼️ 界面预览

![ClawGoal 工作空间](demo/image/claw-office.png)

<table width="100%">
  <thead>
    <tr>
      <th width="50%">智能体</th>
      <th width="50%">项目 / OKR</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td><img width="100%" src="demo/image/claw-agent.png" alt="智能体管理" /></td>
      <td><img width="100%" src="demo/image/claw-project.png" alt="项目管理" /></td>
    </tr>
  </tbody>
</table>

<table width="100%">
  <thead>
    <tr>
      <th width="50%">定时任务</th>
      <th width="50%">资源管理</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td><img width="100%" src="demo/image/claw-cron.png" alt="定时任务" /></td>
      <td><img width="100%" src="demo/image/claw-resource.png" alt="资源管理" /></td>
    </tr>
  </tbody>
</table>

<table width="100%">
  <thead>
    <tr>
      <th width="50%">功能配置</th>
      <th width="50%">系统设置</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td><img width="100%" src="demo/image/claw-config.png" alt="功能配置" /></td>
      <td><img width="100%" src="demo/image/claw-setting.png" alt="系统设置" /></td>
    </tr>
  </tbody>
</table>

## 🎯 为什么是 OKR 驱动？

AI 很擅长生成内容、分析问题和执行工具，但如果缺少目标约束，很容易变成零散对话和一次性任务。ClawGoal 的设计重点是把 AI 工作放进目标管理体系：

- **目标先行**：先明确 Objective，再用 Key Results 衡量结果。
- **项目承接**：把目标落到具体项目，统一管理背景、计划、知识和指标。
- **任务拆解**：把项目继续拆成可执行任务、子任务和待办。
- **Agent 执行**：让不同 Agent 领取任务、调用工具、写入日志并沉淀记忆。
- **过程可控**：通过执行记录、指标、事件、审核和定时复盘持续校准方向。

这让 AI 工作从“想到什么问什么”变成“围绕目标持续推进什么”。✨

## ✨ 功能亮点

### 🎯 OKR、项目与任务闭环

- OKR / Objective 管理：维护目标、关键结果、聚焦项和进度。
- 项目管理：创建项目、设置状态、颜色、Logo、起止时间和项目说明。
- 任务系统：支持任务树、子任务、状态流转、处理记录和来源追踪。
- Backlog 需求池：集中收集、激活、归档项目待办和需求线索。
- 项目维度的数据沉淀：事件、笔记、Wiki、指标都可以关联到项目。
- 指标追踪：用数据点、图表和汇总观察目标推进效果。

### 🤖 围绕目标工作的智能体

- 创建、配置和管理多个 Agent，支持内置角色与自定义角色。
- 可将 Agent 绑定到项目和任务，让 AI 有明确上下文和执行边界。
- 支持 Agent 会话、执行日志、工具调用记录和工作流消息。
- 支持人工审核 Agent 产生的变更，查看 diff、通过、拒绝或取消合并。
- 支持 Agent 参数表单，让同一角色可以按不同项目、身份或工作方式运行。
- 支持 Agent 记忆与语义检索，为长期协作保留上下文。

### 🧠 知识库、笔记与记忆

- Wiki 管理：支持内容创建、同步、批量同步和同步历史。
- 支持从网页或本地 Markdown 同步知识内容，并生成可检索文本。
- 笔记管理：支持编辑、查看、分享和项目归档。
- 内置 embedding 配置，默认可使用 sqlite-vec，也可切换 OpenAI 兼容 embedding API。
- Agent Memory API 支持记忆的创建、查询、更新和删除。

### ⏱️ 定时任务与自动化

- 可创建 Cron 定时任务，按配置时区执行。
- 支持一次性任务、启停、手动触发、执行历史和日志查看。
- 定时任务可触发 Agent，也可执行 shell / runtime 相关任务，让目标复盘和日常推进自动发生。
- 执行结果可由模型自动总结，便于复盘和追踪。

### 🔌 资源、运行时与 MCP

- 运行时管理：支持本地运行时与 WebSocket 连接的远程运行时。
- 支持连接 Codex、Claude Code、OpenCode、ACP 等外部执行环境。
- MCP Server 管理：配置、连接、查看工具列表，并供 Agent 调用。
- Skill 管理：系统启动时写入内置技能，也支持通过配置追加技能目录。

### 💬 消息渠道与 Webhook

- 支持 Telegram、Slack、Discord、飞书、钉钉、企业微信、LINE、Matrix、Mattermost、Microsoft Teams 等渠道配置。
- 支持渠道 Webhook 和 Agent say hook，可把外部消息接入 Agent。
- 支持频道健康状态、启停和渠道归属配置。

### 📊 指标、事件与分享

- 指标管理：维护项目指标、数据点、图表和汇总，用结果反馈 OKR 进展。
- 事件管理：记录项目事件，支持查看、编辑和公开分享。
- 笔记分享和事件分享提供公开访问路由。
- 工作空间首页包含 3D Office 场景，为 Agent 和项目协作提供更直观的入口。

## 🚀 快速开始

### 环境要求

- Node.js `>= 24.0.0`
- pnpm `>= 8.0.0`
- Bun
- Go 与 Wails，仅在构建桌面客户端时需要

### 安装依赖

```bash
make install
```

或：

```bash
pnpm install
```

### 启动开发环境

```bash
make dev
```

开发模式会先生成接口文档和内置角色文件，然后同时启动：

- 前端：http://localhost:53000
- 后端：http://localhost:3000

如果希望清空开发数据并写入 Demo 数据：

```bash
make dev-seed
```

### 构建

```bash
make build
```

或：

```bash
pnpm build
```

### 代码检查与格式化

```bash
pnpm check
```

## 🔧 配置说明

配置示例位于：

```text
packages/backend/src/config/config.example.yaml
```

运行时默认会从 `~/.clawgoal/data/config.yaml` 读取配置，也可以通过环境变量覆盖数据目录：

```bash
DATA_PATH=/path/to/data pnpm --filter @clawgoal/backend dev
```

核心配置包括：

- `port`：后端 HTTP 服务端口。
- `timezone`：Cron 调度和模型时间注入使用的 UTC 偏移。
- `lang`：默认语言，支持 `en-US` 与 `zh-CN`。
- `database`：目前仅支持 `sqlite`。
- `auth` / `jwt`：登录方式、默认用户和 JWT Secret。
- `upload`：上传存储后端与文件限制。
- `proxy`：模型调用代理。
- `modelProviders`：模型供应商与模型列表。
- `embeddingModel`：知识记忆和语义检索使用的 embedding 后端。
- `model`：逻辑模型别名与 fallback 链。
- `agent`：Agent 并发数与任务数据目录。
- `claw.skillDirs`：追加自定义技能目录。

> ⚠️ 生产环境请务必修改默认账号、密码、JWT Secret、模型 API Key 和上传配置。

## 🖥️ CLI 与桌面端

后端包构建后提供 `clawgoal` CLI，可用于前台运行、后台守护进程、服务安装和运行时连接等操作。

常见命令包括：

```bash
clawgoal serve
clawgoal daemon start
clawgoal daemon status
clawgoal daemon stop
```

桌面端位于 `client/`，使用 Wails 封装。桌面客户端会启动内置后端二进制，并在首次启动时引导生成数据目录与 `config.yaml`。

## 🧩 Open Source 场景建议

ClawGoal 适合这些场景：

- 个人 OKR 工作台：把年度目标、阶段关键结果和每日任务统一管理。
- 团队目标协作：为不同职责创建 Agent，让它们围绕项目和目标持续工作。
- 内容与运营自动化：结合定时任务、渠道、知识库和指标做自动复盘。
- 开发工作流增强：把需求、任务、代码执行、审核和复盘放进目标链路。
- AI 产品原型：基于现有 OKR、Agent、任务、工作流、审计和配置能力快速扩展。

## 🤝 参与贡献

欢迎提交 Issue、功能建议和 Pull Request。建议在贡献前先执行：

```bash
pnpm check
pnpm build
```

如果新增业务能力，请尽量同步补充中英文文案、配置示例和必要的接口说明。

## 加入交流群

> 添加时请备注 ClawGoal

<table width="100%">
  <thead>
    <tr>
      <th width="50%">微信交流群</th>
      <th width="50%">QQ 交流群</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>
        <img style="width:100%;" src="https://open.tecmz.com/code_dynamic/wx" alt="微信交流群" />
      </td>
      <td>
        <img style="width:100%;" src="https://open.tecmz.com/code_dynamic/qq" alt="QQ 交流群" />
      </td>
    </tr>
  </tbody>
</table>

## 📄 License

本项目基于 Apache License 2.0 开源协议发布，详见 [LICENSE](/Users/mz/data/project/clawgoal/clawgoal-pro/LICENSE)。
