/**
 * 构建脚本：解析所有路由文件中的 JSDoc 注释，生成 Swagger/OpenAPI 3.0 格式的接口文档。
 * 生成 src/generated/apiDocData.ts，供 Bun 打包时嵌入二进制。
 *
 * 注释格式（路由处理函数上方）：
 * /**
 *  * @Api /api/path/to/endpoint
 *  * @Method GET          (可选，默认 POST)
 *  * @Tag 分组名称         (可选，用于 Swagger 分组)
 *  * @Summary 接口说明     (可选)
 *  * @BodyParam name type description
 *  * @QueryParam name type description
 *  * @ReturnDataExample {"key":"value"}
 *  * /
 *
 * 使用方式：bun run scripts/genApiDoc.ts
 */

import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'fs'
import { safeJsonParse } from '../src/utils/json.js'
import packageJson from '../package.json' with { type: 'json' }
import { dirname, join, relative } from 'path'

interface RouteDoc {
  path: string
  method: string
  tag: string
  summary: string
  bodyParams: Array<{ name: string; type: string; description: string; required: boolean }>
  queryParams: Array<{ name: string; type: string; description: string; required: boolean }>
  returnExample: unknown
  auth: boolean
  file: string
}

const NO_AUTH_PATHS = new Set([
  '/login',
  '/ping',
  '/apiDoc.json',
])

const NO_AUTH_PREFIXES = ['/captcha/', '/mock/', '/hook/', '/ops/_git/']

function isPublicRoute(apiPath: string): boolean {
  if (NO_AUTH_PATHS.has(apiPath)) return true
  for (const prefix of NO_AUTH_PREFIXES) {
    if (apiPath.startsWith(prefix)) return true
  }
  return false
}

function mapTypeToSwagger(t: string): { type: string; format?: string } {
  switch (t.toLowerCase()) {
    case 'number':
    case 'integer':
    case 'int':
      return { type: 'integer' }
    case 'float':
    case 'double':
      return { type: 'number', format: 'float' }
    case 'boolean':
    case 'bool':
      return { type: 'boolean' }
    case 'array':
      return { type: 'array' }
    case 'object':
      return { type: 'object' }
    default:
      return { type: 'string' }
  }
}

/**
 * 从文件内容中解析所有路由文档注释
 */
function parseRouteDocs(content: string, filePath: string): RouteDoc[] {
  const docs: RouteDoc[] = []

  // 匹配 JSDoc 注释块 + 紧接其后的 router.METHOD(...)
  const blockRegex = /\/\*\*([\s\S]*?)\*\/\s*\nrouter\.(get|post|put|delete|patch)\s*\(\s*['"`]([^'"`]+)['"`]/g
  let match: RegExpExecArray | null

  while ((match = blockRegex.exec(content)) !== null) {
    const commentBlock = match[1]
    const httpMethod = match[2].toUpperCase()
    const routePath = match[3]

    // 提取 @Api 标签（如果没有则跳过）
    const apiMatch = commentBlock.match(/@Api\s+(\/[^\s\n]*)/)
    if (!apiMatch) continue

    const apiPath = '/api' + apiMatch[1].replace(/^\/api/, '')

    // 提取 @Method（可覆盖从代码检测到的方法）
    const methodMatch = commentBlock.match(/@Method\s+(\w+)/)
    const finalMethod = methodMatch ? methodMatch[1].toUpperCase() : httpMethod

    // 提取 @Tag
    const tagMatch = commentBlock.match(/@Tag\s+(.+)/)
    const tag = tagMatch ? tagMatch[1].trim() : inferTag(apiPath)

    // 提取 @Summary
    const summaryMatch = commentBlock.match(/@Summary\s+(.+)/)
    const summary = summaryMatch ? summaryMatch[1].trim() : inferSummary(apiPath)

    // 提取 @BodyParam
    const bodyParams: RouteDoc['bodyParams'] = []
    const bodyParamRegex = /@BodyParam\s+(\S+)\s+(\S+)(?:\s+(.+))?/g
    let bpMatch: RegExpExecArray | null
    while ((bpMatch = bodyParamRegex.exec(commentBlock)) !== null) {
      const name = bpMatch[1]
      const rawType = bpMatch[2]
      const description = bpMatch[3]?.trim() ?? ''
      const required = !name.endsWith('?')
      bodyParams.push({ name: name.replace(/\?$/, ''), type: rawType, description, required })
    }

    // 提取 @QueryParam
    const queryParams: RouteDoc['queryParams'] = []
    const queryParamRegex = /@QueryParam\s+(\S+)\s+(\S+)(?:\s+(.+))?/g
    let qpMatch: RegExpExecArray | null
    while ((qpMatch = queryParamRegex.exec(commentBlock)) !== null) {
      const name = qpMatch[1]
      const rawType = qpMatch[2]
      const description = qpMatch[3]?.trim() ?? ''
      const required = !name.endsWith('?')
      queryParams.push({ name: name.replace(/\?$/, ''), type: rawType, description, required })
    }

    // 提取 @ReturnDataExample
    const returnMatch = commentBlock.match(/@ReturnDataExample\s+(\{[\s\S]*?\})(?=\s*\n\s*\*|\s*$)/)
    let returnExample: unknown = null
    if (returnMatch) {
      try {
        returnExample = safeJsonParse(returnMatch[1].trim(), {}, 'genApiDoc.returnExample')
      } catch {
        returnExample = returnMatch[1].trim()
      }
    }

    const auth = !isPublicRoute(apiPath)

    const relFile = relative(join(dirname(import.meta.dir), '..'), filePath).replace(/\\/g, '/')

    docs.push({
      path: apiPath,
      method: finalMethod,
      tag,
      summary,
      bodyParams,
      queryParams,
      returnExample,
      auth,
      file: relFile,
    })
  }

  return docs
}

function inferTag(apiPath: string): string {
  const parts = apiPath.replace(/^\/api\//, '').split('/')
  const segment = parts[0] ?? 'general'
  const tagMap: Record<string, string> = {
    login: 'Auth',
    ping: 'System',
    captcha: 'Captcha',
    account: 'Account',
    model: 'Model',
    upload: 'Upload',
    mock: 'Mock',
    config: 'Config',
    setting: 'Setting',
    system: 'System',
    env: 'Env',
    param: 'Param',
    hook: 'Webhook',
    claw: 'Claw',
  }
  return tagMap[segment] ?? segment
}

function inferSummary(apiPath: string): string {
  const parts = apiPath.replace(/^\/api\//, '').split('/')
  return parts.join(' / ')
}

/**
 * 扫描目录中所有路由文件
 */
function scanRouteFiles(dir: string): string[] {
  if (!existsSync(dir)) return []
  const results: string[] = []
  function walk(d: string) {
    for (const entry of readdirSync(d, { withFileTypes: true })) {
      const full = join(d, entry.name)
      if (entry.isDirectory()) walk(full)
      else if (entry.isFile() && entry.name.endsWith('.ts')) results.push(full)
    }
  }
  walk(dir)
  return results
}

/**
 * 将路由文档转换为 OpenAPI paths 对象
 */
function buildOpenApiPaths(docs: RouteDoc[]): Record<string, unknown> {
  const paths: Record<string, Record<string, unknown>> = {}

  for (const doc of docs) {
    if (!paths[doc.path]) paths[doc.path] = {}
    const method = doc.method.toLowerCase()

    const operation: Record<string, unknown> = {
      tags: [doc.tag],
      summary: doc.summary,
      security: doc.auth ? [{ bearerAuth: [] }] : [],
    }

    // 构建请求体
    if (doc.bodyParams.length > 0) {
      const properties: Record<string, unknown> = {}
      const required: string[] = []
      for (const p of doc.bodyParams) {
        const swaggerType = mapTypeToSwagger(p.type)
        properties[p.name] = {
          ...swaggerType,
          description: p.description,
        }
        if (p.required) required.push(p.name)
      }
      operation.requestBody = {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties,
              ...(required.length > 0 ? { required } : {}),
            },
          },
        },
      }
    }

    // 构建 query 参数
    if (doc.queryParams.length > 0) {
      operation.parameters = doc.queryParams.map((p) => ({
        name: p.name,
        in: 'query',
        required: p.required,
        description: p.description,
        schema: mapTypeToSwagger(p.type),
      }))
    }

    // 构建响应
    let responseExample: unknown = {
      code: 0,
      msg: 'success',
      data: doc.returnExample ?? {},
    }
    if (doc.returnExample !== null) {
      responseExample = { code: 0, msg: 'success', data: doc.returnExample }
    }

    operation.responses = {
      '200': {
        description: '成功',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                code: { type: 'integer', example: 0 },
                msg: { type: 'string', example: 'success' },
                data: { type: 'object' },
              },
            },
            example: responseExample,
          },
        },
      },
    }

    paths[doc.path][method] = operation
  }

  return paths
}

// ── 主流程 ──────────────────────────────────────────────────────────────────

const scriptDir = import.meta.dir
const packagesDir = join(scriptDir, '../..')

const routeDirs = [
  join(packagesDir, 'backend/src/api/routes'),
  join(packagesDir, 'backend-claw/src/api/routes'),
]

const allDocs: RouteDoc[] = []

for (const dir of routeDirs) {
  const files = scanRouteFiles(dir)
  for (const file of files) {
    const content = readFileSync(file, 'utf-8')
    const docs = parseRouteDocs(content, file)
    allDocs.push(...docs)
  }
}

// 添加 /api/ping 端点文档
allDocs.unshift({
  path: '/api/ping',
  method: 'POST',
  tag: '系统',
  summary: '服务心跳检测',
  bodyParams: [],
  queryParams: [],
  returnExample: { ready: true, timestamp: '2026-01-01T00:00:00.000Z' },
  auth: false,
  file: 'backend/src/api/routes/api.ts',
})

// 添加 /api/apiDoc.json 端点文档
allDocs.push({
  path: '/api/apiDoc.json',
  method: 'GET',
  tag: '系统',
  summary: '获取接口文档（Swagger/OpenAPI 3.0）',
  bodyParams: [],
  queryParams: [],
  returnExample: null,
  auth: false,
  file: 'backend/src/api/routes/api.ts',
})

// 按 tag + path 排序，使文档输出有序
allDocs.sort((a, b) => {
  if (a.tag !== b.tag) return a.tag.localeCompare(b.tag)
  return a.path.localeCompare(b.path)
})

const paths = buildOpenApiPaths(allDocs)

const swaggerDoc = {
  openapi: '3.0.0',
  info: {
    title: 'ClawGoal API',
    version: packageJson.version || '0.0.1',
    description: '由 scripts/genApiDoc.ts 在构建时自动生成。',
  },
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
      },
    },
  },
  paths,
}

const outputDir = join(scriptDir, '../src/generated')
if (!existsSync(outputDir)) mkdirSync(outputDir, { recursive: true })

const outputPath = join(outputDir, 'apiDocData.ts')

const tsContent = `// 自动生成，勿手动编辑。由 scripts/genApiDoc.ts 在构建时自动生成。
/* eslint-disable */
export const apiDocData = ${JSON.stringify(swaggerDoc, null, 2)} as const
`

writeFileSync(outputPath, tsContent, 'utf-8')

const routeCount = allDocs.length
console.log(`✅ 已生成接口文档：${routeCount} 个接口 → ${outputPath}`)
