/**
 * Model conversation-related API routes
 */
import { AIMessage, BaseMessage, HumanMessage } from '@langchain/core/messages'
import { Router } from 'express'
import { getModelConfigList, config } from '../../config'
import { useI18n } from '../../locale'
import { modelCall, modelStream } from '../../model/model'
import { apiHandler } from '../../utils/api'
import { jsonStringify, safeJsonParse } from '../../utils/json.js'
import { logger } from '../../utils/logger'
import { error, success } from '../../utils/response'
import type { AuthRequest } from '../middlewares/auth'
import { ResponseCodes } from '../types/constants'
import { userDb } from '../../storage/sqlite/store/user.js'
import { AppConfig } from '../../config.js'
import { getUserAgent } from '../../utils/utils.js'
import { buildUserAgent } from '../../utils/platform.js'
import {
  type BuiltinModelSetting,
  getBuiltinParam,
  saveBuiltinParam,
  setDefaultProvider,
  setDefaultModel,
} from '../../model/modelProvider.js'

const router = Router()

/**
 * Convert request messages to LangChain message format
 */
const convertMessages = (
  messages: Array<{ role: string; content: string }>
): BaseMessage[] => {
  return messages.map((msg) => {
    if (msg.role === 'user') {
      return new HumanMessage(msg.content)
    } else if (msg.role === 'assistant') {
      return new AIMessage(msg.content)
    }
    return new HumanMessage(msg.content)
  })
}

// ─── 统一提供商列表 ────────────────────────────────────────────────────────────

/**
 * @Api /api/model/providerList
 * @Summary 获取完整的模型提供商列表（自定义 + 内置），含默认状态
 * @ReturnDataExample {"providers":[{"name":"openai","provider":"openai","isDefault":true,"models":[{"name":"gpt-4o"}]},{"name":"builtin","provider":"custom","_builtIn":true,"isDefault":false,"builtinQuota":100000,"models":[{"name":"deepseek-chat","builtinId":"deepseek-chat","builtinRate":1}]}]}
 */
router.post(
  '/model/providerList',
  apiHandler(async (req, res) => {
    const authReq = req as AuthRequest
    const { userId, tenantId } = authReq.user

    // 自定义提供商（来自 config.yaml）
    const customProviders = config.modelProviders.map((p) => ({
      name: p.name,
      provider: p.provider,
      format: p.format,
      apiBase: p.apiBase,
      apiKey: p.apiKey,
      isDefault: p.isDefault ?? false,
      proxyName: p.proxyName,
      models: p.models,
      _builtIn: false as const,
    }))


    const providers = [
      ...customProviders,
    ]

    return success(res, { providers })
  })
)

/**
 * @Api /api/model/providerDefault/set
 * @Summary 设置默认提供商（自定义或内置），自动清除其他提供商的默认标记
 * @BodyParam providerName string 提供商名称（自定义提供商的 name，或 'builtin'）
 * @ReturnDataExample {"saved":true}
 */
router.post(
  '/model/providerDefault/set',
  apiHandler(async (req, res) => {
    const authReq = req as AuthRequest
    const { userId, tenantId } = authReq.user
    const { providerName } = req.body as { providerName: string }

    if (!providerName) {
      return error(res, ResponseCodes.DEFAULT_ERROR, 'providerName is required')
    }

    await setDefaultProvider(tenantId, userId, providerName)
    return success(res, { saved: true })
  })
)

/**
 * @Api /api/model/builtinProvider/save
 * @Summary 保存内置提供商的模型设置（可见性、默认模型、参数）
 * @BodyParam models array 模型设置列表
 * @ReturnDataExample {"saved":true}
 */
router.post(
  '/model/builtinProvider/save',
)

/**
 * @Api /api/model/list
 * @Summary List model
 * @ReturnDataExample {"models":[{"nameRef":"openai|gpt-4o","provider":"openai","model":"gpt-4o","builtin":false}],"builtinModels":[{"nameRef":"builtin|deepseek-chat","provider":"builtin","model":"deepseek-chat","name":"DeepSeek Chat","rate":1}]}
 */
router.post(
  '/model/list',
  apiHandler(async (req, res) => {
    const authReq = req as AuthRequest
    const userId = authReq.user.userId
    const tenantId = authReq.user.tenantId
    const defaultList = await getModelConfigList(userId, tenantId, 'default')
    const models: Array<{ nameRef: string; provider: string; model: string }> =
      []
    for (const provider of config.modelProviders) {
      for (const modelEntry of provider.models) {
        const modelName =
          typeof modelEntry === 'string'
            ? modelEntry
            : (modelEntry?.name ?? String(modelEntry))
        models.push({
          nameRef: `${provider.name}|${modelName}`,
          provider: provider.name,
          model: modelName,
        })
      }
    }
    if (models.length === 0 && defaultList.length > 0) {
      const d = defaultList[0]
      models.push({ nameRef: d.nameRef, provider: d.type, model: d.model })
    }

    // 获取内置模型列表（从 user.apiData 读取 apiToken，调用远端接口）
    const builtinModels: Array<{
      nameRef: string
      provider: string
      model: string
      name: string
      rate: number
    }> = []
    try {
      const user = await userDb.findById(userId)
      const apiToken = (user?.apiData as Record<string, unknown> | null)
        ?.apiToken as string | undefined
      if (apiToken) {
        // 读取用户配置的内置模型可见性设置
        const paramRaw = await paramDb.getParam(
          tenantId,
          userId,
          'BuildInModelProvider'
        )
        const builtinConfig = paramRaw
          ? (safeJsonParse(paramRaw, null, 'model.builtinConfig') as {
              isDefault?: boolean
              models?: Array<{ id: string; visible?: boolean }>
            })
          : null
        const visibleSet = builtinConfig?.models
          ? new Set(
              builtinConfig.models
                .filter((m) => m.visible !== false)
                .map((m) => m.id)
            )
          : null // null 表示没有设置过，默认全部可见

        const url = `${AppConfig.baseUrl}/api/app_manager/user_info`
        const resp = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': buildUserAgent(),
            'api-token': apiToken,
          },
          signal: AbortSignal.timeout(5000),
        })
        if (resp.ok) {
          const json = (await resp.json()) as {
            code: number
            data?: {
              data?: {
                llmpx?: {
                  // 远端字段：id 可能缺失，用 name 兜底
                  models?: Array<{ id?: string; name: string; rate: number }>
                }
              }
            }
          }
          if (json.code === 0) {
            // 在入口处统一规整：id 缺失时用 name 填充
            const llmpxModels = (json.data?.data?.llmpx?.models ?? [])
              .filter((m) => m != null && (m.id != null || m.name != null))
              .map((m) => ({ ...m, id: (m.id ?? m.name) as string }))
            for (const m of llmpxModels) {
              // 有配置时按可见性过滤，无配置时全部可见
              if (visibleSet !== null && !visibleSet.has(m.id)) continue
              builtinModels.push({
                nameRef: `builtin|${m.id}`,
                provider: 'builtin',
                model: m.id,
                name: m.name,
                rate: m.rate,
              })
            }
          }
        }
      }
    } catch {
      // 内置模型获取失败不影响主流程
    }

    return success(res, { models, builtinModels })
  })
)

/**
 * @Api /api/model/chat
 * @Summary Chat model
 * @BodyParam messages array Array of {role: 'user'|'assistant', content: string}
 * @BodyParam model string Optional model nameRef (e.g. 'openai|gpt-4o')
 * @ReturnDataExample {"message":{"role":"assistant","content":"Hello!"}}
 */
router.post(
  '/model/chat',
  apiHandler(async (req, res) => {
    const { t } = useI18n(req)
    const { messages, model: modelNameRef } = req.body
    const authReq = req as AuthRequest

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return error(res, ResponseCodes.DEFAULT_ERROR, t('modelMessagesRequired'))
    }
    const userId = authReq.user.userId
    const tenantId = authReq.user.tenantId
    const modelConfigList = await getModelConfigList(
      userId,
      tenantId,
      modelNameRef && typeof modelNameRef === 'string'
        ? modelNameRef
        : 'default'
    )
    if (modelConfigList.length === 0) {
      return error(
        res,
        ResponseCodes.DEFAULT_ERROR,
        t('modelApiKeyNotConfigured')
      )
    }
    logger.debug(
      `Invoking Model with model configs: ${modelConfigList.map((c) => c.model).join(', ')}`
    )
    const response = await modelCall({
      tenantId,
      userId,
      biz: 'Chat',
      bizId: String(userId),
      appendMessages: convertMessages(messages),
      temperature: 0.7,
      context: 'Model chat',
      logger,
      modelConfigList,
    })

    let content = ''
    if (response.type === 'text') {
      content = response.content
    } else if (response.type === 'json') {
      content = jsonStringify(response.data)
    } else if (response.type === 'tools') {
      content = t('modelToolCallUseOtherApi')
    }

    return success(res, {
      message: {
        role: 'assistant',
        content,
      },
    })
  })
)

/**
 * @Api /api/model/chatStream
 * @Summary Chat Stream
 * @BodyParam messages array Array of {role: 'user'|'assistant', content: string}
 * @ReturnDataExample SSE stream: data: {"content":"Hello"} ... data: [DONE]
 */
router.post(
  '/model/chatStream',
  apiHandler(async (req, res) => {
    const { t } = useI18n(req)
    const { messages } = req.body
    const authReq = req as AuthRequest

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return error(res, ResponseCodes.DEFAULT_ERROR, t('modelMessagesRequired'))
    }

    const userId = authReq.user.userId
    const tenantId = authReq.user.tenantId
    const modelConfigList = await getModelConfigList(
      userId,
      tenantId,
      'default'
    )
    const modelConfig = modelConfigList[0]

    if (!modelConfig?.apiKey) {
      return error(
        res,
        ResponseCodes.DEFAULT_ERROR,
        t('modelApiKeyNotConfigured')
      )
    }

    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection', 'keep-alive')

    const langchainMessages = convertMessages(messages)

    try {
      const stream = await modelStream({
        appendMessages: langchainMessages,
        temperature: 0.7,
        context: 'Model stream chat',
        logger,
        modelConfigList: [modelConfig],
        biz: 'Chat',
        bizId: String(userId),
        tenantId,
        userId,
      })

      for await (const chunk of stream) {
        const content = chunk.content
        if (content) {
          res.write(`data: ${jsonStringify({ content })}\n\n`)
        }
      }

      res.write('data: [DONE]\n\n')
      res.end()
    } catch (err: any) {
      res.write(`data: ${jsonStringify({ error: err.message })}\n\n`)
      res.end()
    }
  })
)

export default router
