import { daysAgo } from '../../../../../backend/src/storage/seed/util'

export const wikis = [
  {
    id: 1,
    projectId: 1,
    biz: 'techArch',
    title: '项目技术架构总览',
    content: `## 技术栈

- **后端**: Bun + SQLite + Express.js + TypeScript
- **前端**: Vue 3 + Ant Design Vue + TailwindCSS + Vite
- **AI 集成**: OpenAI API / 本地模型（Ollama）
- **向量检索**: SQLite BLOB 存储 Float32Array，内存余弦相似度计算

## 目录结构

\`\`\`
packages/
  backend/   — Express API 服务，LangGraph agent
  ui/        — Vue3 前端
  connector/ — 第三方连接器
\`\`\`

## 部署方式

- 本地开发: \`bun run dev\`
- 生产构建: \`bun run build && bun run start\`
- 推荐使用 PM2 托管进程`,
    sourceUrl: null,
    createdAt: daysAgo(28),
  },
  {
    id: 2,
    projectId: 1,
    title: 'API 接口设计规范',
    content: `## 统一规范

所有 API 端点均为 **POST**，无 RESTful 动词区分。

### 请求格式

\`\`\`json
POST /api/claw/{resource}/{action}
Content-Type: application/json
\`\`\`

### 响应格式

\`\`\`json
{
  "code": 0,       // 0=成功, 非0=错误
  "msg": "ok",
  "data": {}
}
\`\`\`

### 常用错误码

| code | 含义 |
|------|------|
| 0    | 成功 |
| 400  | 参数错误 |
| 401  | 未登录 |
| 403  | 权限不足 |
| 404  | 资源不存在 |
| 500  | 服务器内部错误 |`,
    sourceUrl: null,
    createdAt: daysAgo(25),
  },
  {
    id: 3,
    projectId: 1,
    title: '数据库表命名规范',
    content: `## 命名规则

- 表名格式: \`claw_{module}\`
- 示例: \`claw_project\`、\`claw_wiki\`

## 公共字段

每张表都应包含：

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER PK AUTOINCREMENT | 主键 |
| created_at | TEXT | 创建时间（localtime） |
| updated_at | TEXT | 更新时间（trigger 维护） |
| user_id | INTEGER | 所属用户 |

## 迁移规范

- 增量迁移写在 \`db.schema.ts\` 的 \`MIGRATIONS\` 数组中
- 迁移名称格式: \`create_{表名}_table\` 或 \`add_{字段}_{表名}\``,
    sourceUrl: null,
    createdAt: daysAgo(20),
  },
  {
    id: 4,
    projectId: 1,
    title: 'Embedding 向量化接入指南',
    content: `## 概述

系统通过 \`AbstractEmbeddingProvider\` 统一管理向量化与检索，默认使用 **sqlite-vec** 作为向量存储后端。

向量数据独立存储在 \`data/db/chunks.db\`，与主库解耦，支持任意维度的 embedding 模型。

## 支持的 embedding 模型类型

通过 \`config.embeddingModel.type\` 选择：

| type | 说明 |
|------|------|
| \`local\` | 使用本地模型（Xenova/transformers.js） |
| \`openai\` | 调用 OpenAI text-embedding-ada-002 |
| \`none\` | 不启用向量化，退回关键词检索 |

## Provider 使用方式

\`\`\`typescript
import { getEmbeddingProvider } from '../../../../../backend/src/storage/model/embedding/sqliteVecProvider.js';

const provider = getEmbeddingProvider();

// 写入 / 更新
await provider.upsert('project_wiki:1', '42', '文档内容...');

// 检索（返回 refId + 相似度分数）
const results = await provider.search('project_wiki:1', '用户的问题', 5);

// 删除单条
await provider.delete('project_wiki:1', '42');

// 删除整个命名空间
await provider.deleteNamespace('project_wiki:1');
\`\`\`

## 存储结构（chunks.db）

\`\`\`sql
chunk_meta (id, biz_id, ref_id, created_at)  -- 条目元数据
chunk_vecs (meta_id, embedding BLOB)             -- 向量存储
\`\`\`

检索使用 \`vec_distance_cosine()\` SQL 函数，相似度分数 = \`max(0, 1 - cosine_distance)\`。`,
    sourceUrl: null,
    createdAt: daysAgo(15),
  },
  {
    id: 5,
    projectId: 1,
    title: '前端组件开发规范',
    content: `## 技术要求

- Vue 3 Composition API（\`<script setup>\`）
- TypeScript 严格模式
- Ant Design Vue 组件库
- Lucide Vue Next 图标库
- TailwindCSS 样式

## 文件结构

\`\`\`
views/Claw/Feature/
  FeatureList.vue         — 列表页
  FeatureDetail.vue       — 详情页（多 Tab）
  FeatureDetail/
    FeatureDetailXxx.vue  — Tab 子组件
    FeatureEditModal.vue  — 编辑弹窗
\`\`\`

## 数据请求规范

- 使用 \`useMessage()\` 处理 API 错误
- loading 状态用 \`ref<boolean>(false)\` 管理
- 列表用 \`ref<Item[]>([]) 初始化

## i18n

- 所有文案通过 \`useI18n()\` 的 \`t()\` 函数引用
- key 格式: \`{模块}.{功能}.{含义}\``,
    sourceUrl: null,
    createdAt: daysAgo(10),
  },
  // ── Project 2: 独立产品 MVP 上线 ──────────────────────────────────────────
  {
    id: 6,
    projectId: 2,
    title: '产品定位与核心功能定义',
    content: `## 产品定位

面向**内容创作者**（自媒体、独立博客、SEO 运营）的关键词推荐工具，帮助用户快速发现高搜索量、低竞争度的长尾关键词，提升内容曝光率。

## 差异化优势

| 竞品 | 我们的差异化 |
|------|------------|
| Ahrefs / SEMrush | 价格门槛高，面向专业 SEO；我们面向普通创作者，极简上手 |
| Ubersuggest | 免费额度有限；我们提供持续免费基础版 |
| 谷歌关键词规划 | 数据粗糙；我们结合内容语义给出创作建议 |

## 核心功能（MVP）

1. **关键词发现**：输入种子词，返回相关长尾词及搜索量/竞争度评分
2. **竞品内容分析**：分析 SERP Top 10 内容结构，输出写作建议
3. **导出功能**：一键导出关键词列表（CSV / Markdown）

## 非功能性要求

- 首屏响应 < 2s
- 支持中英文双语关键词
- 无需注册可体验核心功能（转化钩子）`,
    sourceUrl: null,
    createdAt: daysAgo(28),
  },
  {
    id: 7,
    projectId: 2,
    title: '技术选型与架构方案',
    content: `## 后端技术栈

- **运行时**: Bun（高性能，原生 TS 执行）
- **Web 框架**: Express.js
- **数据库**: SQLite（轻量，单文件部署）
- **关键词数据源**: Google Keyword Planner API + 自有爬虫缓存

## 前端技术栈

- **框架**: Vue 3 + Vite
- **UI**: Ant Design Vue + TailwindCSS
- **状态管理**: Pinia

## 部署方案

\`\`\`
用户请求 → Cloudflare CDN → VPS (Bun 服务)
                                    ↓
                              SQLite (数据)
                              Redis (缓存关键词数据)
\`\`\`

## 接入第三方 API

| 服务 | 用途 | 费用预估 |
|------|------|--------|
| Google Search Console API | 获取真实搜索数据 | 免费 |
| DataForSEO | 关键词难度评分 | $50/月 |
| OpenAI API | 内容建议生成 | 按量计费 |`,
    sourceUrl: null,
    createdAt: daysAgo(25),
  },
  {
    id: 8,
    projectId: 2,
    title: '冷启动获客策略',
    content: `## 目标

MVP 上线后 30 天内获取前 100 名真实用户，其中 5 名付费用户完成商业模式验证。

## 渠道优先级

### 第一阶段（0-2 周）：种子用户

- **V2EX / 即刻**：发帖展示产品，针对独立开发者 / SEO 从业者圈子
- **个人社群**：微信群、知识星球定向邀请内测
- **ProductHunt 预热**：创建 Coming Soon 页面积累 followers

### 第二阶段（3-4 周）：口碑扩散

- **免费工具内嵌 CTA**：导出功能加水印 + 分享链接
- **内容营销**：在知乎/公众号发布《内容创作者 SEO 入门指南》带工具软植入
- **KOL 合作**：联系 3-5 名粉丝 1W+ 的内容博主合作测评

## 关键转化节点

\`\`\`
免费体验 → 注册账号（进度保存）→ 超出免费额度 → 付费升级
              ↑
        邮件 + 推送留存策略
\`\`\`

## 定价策略（草案）

| 计划 | 价格 | 说明 |
|------|------|------|
| 免费版 | ¥0 | 每日 5 次查询 |
| Pro | ¥49/月 | 无限查询 + 竞品分析 |
| 年付 | ¥399/年 | Pro 全功能（约 6.8 折）|`,
    sourceUrl: null,
    createdAt: daysAgo(20),
  },
  {
    id: 9,
    projectId: 2,
    title: '开发规范与协作流程',
    content: `## 分支策略

\`\`\`
main          — 生产分支，只通过 PR 合并
dev           — 开发主干
feat/{name}   — 功能分支，从 dev 切出
fix/{name}    — Bug 修复分支
\`\`\`

## Commit 规范

格式：\`type(scope): 简短描述\`

| type | 说明 |
|------|------|
| feat | 新功能 |
| fix | Bug 修复 |
| docs | 文档更新 |
| refactor | 重构（无功能变更） |
| test | 测试相关 |
| chore | 构建 / 依赖更新 |

## 代码审查

- PR 必须有至少 1 名 Reviewer approved 才能合并
- CI 通过（lint + type-check + unit test）才可合并
- 单次 PR 变更行数 < 400 行（大功能拆 PR）

## 发布节奏

- 每周四 16:00 发 Release 分支，冻结功能
- 每周五 10:00 上线（保留 2 天窗口期回滚）`,
    sourceUrl: null,
    createdAt: daysAgo(15),
  },
  {
    id: 10,
    projectId: 2,
    title: '付费用户反馈汇总（第一批内测）',
    content: `## 反馈来源

内测用户 12 名，均来自 V2EX 帖子招募（SEO 从业者 8 名，内容创作者 4 名）。

## 高频问题

### 🔴 阻塞性问题

1. **关键词数据量太少**：用户反映国内长尾词覆盖不足，尤其是小红书/抖音平台关键词
2. **竞争度评分不准**：和 Ahrefs 数据偏差大，用户不信任

### 🟡 改进建议

1. 支持批量导入种子词（目前每次只能输入 1 个）
2. 增加关键词趋势图（月度搜索量变化）
3. 移动端体验差（纯 PC 布局未做响应式）

### 🟢 正向反馈

- UI 简洁，上手快（7/12 用户提到）
- 内容写作建议功能有差异化（5/12 用户认为是亮点）
- 导出格式满足需求

## 下一步迭代优先级

1. 接入更多国内数据源（百度指数 API / 自有爬虫）
2. 批量关键词输入功能
3. 移动端响应式适配`,
    sourceUrl: null,
    createdAt: daysAgo(5),
  },
  // ── Project 6: 2026 年度内容日历规划 ──────────────────────────────────────
  {
    id: 601,
    projectId: 6,
    biz: 'contentPlan',
    title: '全年内容主题规划方法论',
    content: `## 概述

内容日历规划以"主题矩阵 + 节点驱动"为核心框架，确保全年内容有主线、有节奏、有复用性。

## 主题矩阵设计

### 纵轴：内容类别（What）

| 类别 | 说明 | 占比 |
|------|------|------|
| 深度教程 | 步骤详细、可操作的技能类内容 | 30% |
| 工具测评 | 横评或单品评测，带使用体验 | 20% |
| 案例拆解 | 真实项目复盘，数据+结论 | 20% |
| 观点输出 | 行业判断与个人视角 | 20% |
| 问答互动 | 读者提问回答，提升粘性 | 10% |

### 横轴：月度主题（When）

每月聚焦 1-2 个关键词群，避免内容散乱：

- **1 月**：新年规划 + AI 工具年度盘点
- **2 月**：春节营销 + 内容创作者效率提升
- **3 月**：内容日历建立 + 选题方法论
- **4 月**：AI Agent 实战 + 独立开发出海
- **5 月**：SEO 增长 + 流量变现
- **6 月**：618 营销内容 + 数据复盘
- **7 月**：暑期学习内容 + 工具评测
- **8 月**：出海内容矩阵 + Newsletter 运营
- **9 月**：AI 产品发布季盘点
- **10 月**：双11 营销 + 内容变现案例
- **11 月**：年度复盘准备 + 知识付费
- **12 月**：年终总结 + 新年展望

## 规划流程（每月第一周执行）

1. 检查当月节点日历（节日、行业事件）
2. 从选题库中筛选 8-10 个候选选题
3. 按评分模型筛出 4-6 个进入日历
4. 分配到各平台（公众号 / 知乎 / 小红书）
5. 提前准备素材（数据、截图、案例）`,
    sourceUrl: null,
    createdAt: daysAgo(3),
  },
  {
    id: 602,
    projectId: 6,
    title: '内容选题评分标准（选题库管理规范）',
    content: `## 评分维度说明

每个候选选题从以下 5 个维度打分，总分 0–10 分，≥ 7 分优先进入发布日历。

### 维度 1：搜索需求（0–2 分）

- 2 分：目标关键词月均搜索量 > 1000
- 1 分：月均搜索量 500–1000
- 0 分：月均搜索量 < 500

### 维度 2：竞争难度（0–2 分）

- 2 分：SEO 难度评分 < 30，内容蓝海
- 1 分：难度评分 30–60，有竞争但可突破
- 0 分：难度评分 > 60，强竞争

### 维度 3：个人专长匹配度（0–2 分）

- 2 分：深度使用过，有一手经验
- 1 分：基本了解，需补充调研
- 0 分：完全陌生，不建议写

### 维度 4：变现/引流潜力（0–2 分）

- 2 分：可植入产品软广或直接导流
- 1 分：可间接提升个人品牌
- 0 分：纯科普，变现价值低

### 维度 5：时效性（0–2 分）

- 2 分：当月热点，错过即流失
- 1 分：常青内容，任何时间可写
- 0 分：过时内容，不建议投入

## 选题库维护规则

- **收集来源**：RSS 订阅 / 读者问答 / AI 工具扫描 / 竞品内容
- **录入频率**：每周一更新一次选题库
- **目标存量**：始终保持 200+ 备用选题
- **清理机制**：每季度清理超过 6 个月未发布的低分选题

\`\`\`
选题状态流转：
新收集 → 待评分 → 入库 → 计划发布 → 已发布 / 已放弃
\`\`\``,
    sourceUrl: null,
    createdAt: daysAgo(2),
  },
  {
    id: 603,
    projectId: 6,
    title: '各类内容模板使用指南',
    content: `## 5 套通用内容模板

### 模板 A：干货长文（深度教程）

\`\`\`markdown
# [动词] + [目标] + [方法/工具]：[核心承诺]
（例：用 AI 每天产出 5 篇内容：完整工作流拆解）

## 前言（100–200 字）
痛点共鸣 + 解决方案预告

## 正文（1500–2500 字）
### 第一步：XXX
### 第二步：XXX
### 第三步：XXX（含截图/数据）

## 总结（200 字）
核心要点 + 行动指南

## 互动引导
「你有什么问题？评论区见」
\`\`\`

### 模板 B：工具推荐（横评/单品）

\`\`\`markdown
# [数字] 款 [类别] 工具测评：[差异化角度]

## 测评标准说明
## 工具 1：[名称]（优点 / 缺点 / 适合人群）
## 工具 2：[名称]
## 横向对比表格
## 我的推荐选择
\`\`\`

### 模板 C：案例拆解

\`\`\`markdown
# [项目名称]：[核心成果数据]背后的完整复盘

## 背景与目标
## 执行过程（时间线）
## 关键数据（图表）
## 踩过的坑
## 可复用的方法论
\`\`\`

### 模板 D：观点输出

\`\`\`markdown
# 我认为[行业/趋势]正在经历 [变化]

## 判断依据（3 个数据点）
## 对创作者的影响
## 我的应对策略
## 争议点与反方观点
\`\`\`

### 模板 E：问答互动

\`\`\`markdown
# 读者问：[问题]？我的回答是…

## 问题背景
## 直接回答（1–2 句）
## 详细解释（含案例）
## 延伸思考
\`\`\`

## 模板使用注意事项

- 不得完全照搬，需根据具体选题调整
- 每篇文章只用一种主模板，避免混搭
- 标题公式：\`[数字/疑问词] + [目标用户痛点] + [承诺结果]\``,
    sourceUrl: null,
    createdAt: daysAgo(1),
  },
]
