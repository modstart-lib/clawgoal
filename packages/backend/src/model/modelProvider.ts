/**
 * 模型提供者工具函数
 *
 * 封装默认提供者/默认模型的读写逻辑，供 API 路由和配置层复用。
 */
import fs from 'fs'
import { parseDocument } from 'yaml'
import { config, getConfigFilePath, reloadConfig } from '../config/index.js'
import { paramDb } from '../storage/store/userParam.js'
import { safeJsonParse } from '../utils/json.js'

// ─── 类型 ─────────────────────────────────────────────────────────────────────

export interface BuiltinModelSetting {
  id: string
  visible?: boolean
  isDefault?: boolean
  temperature?: number | null
  maxTokens?: number | null
  contextWindow?: number | null
}

export interface BuiltinProviderParam {
  isDefault: boolean
  models: BuiltinModelSetting[]
}

const BUILTIN_PARAM_KEY = 'BuildInModelProvider'

// ─── 内置 provider param 读写 ─────────────────────────────────────────────────

export async function getBuiltinParam(
  tenantId: number,
  userId: number
): Promise<BuiltinProviderParam> {
  const raw = await paramDb.getParam(tenantId, userId, BUILTIN_PARAM_KEY)
  if (!raw) return { isDefault: false, models: [] }
  try {
    return safeJsonParse(
      raw,
      { isDefault: false, models: [] },
      'modelProvider'
    ) as BuiltinProviderParam
  } catch {
    return { isDefault: false, models: [] }
  }
}

export async function saveBuiltinParam(
  tenantId: number,
  userId: number,
  data: BuiltinProviderParam
): Promise<void> {
  await paramDb.setParam(
    tenantId,
    userId,
    BUILTIN_PARAM_KEY,
    JSON.stringify(data)
  )
}

// ─── config.yaml 自定义 provider 写入 ────────────────────────────────────────

/**
 * 将内存中的 config.modelProviders 同步写回 config.yaml，并 reload。
 * 调用方负责在写入前修改好 providers 数组（isDefault 等字段）。
 */
export function syncConfigProviders(): void {
  const configPath = getConfigFilePath()
  const rawContent = fs.readFileSync(configPath, 'utf-8')
  const doc = parseDocument(rawContent)
  const providers = config.modelProviders
  doc.set(
    'modelProviders',
    providers.map((p) => ({
      name: p.name,
      provider: p.provider,
      ...(p.format ? { format: p.format } : {}),
      apiBase: p.apiBase,
      apiKey: p.apiKey,
      ...(p.isDefault ? { isDefault: true } : {}),
      ...(p.proxyName ? { proxyName: p.proxyName } : {}),
      models: p.models,
    }))
  )
  fs.writeFileSync(configPath, doc.toString(), 'utf-8')
  reloadConfig()
}

// ─── 设置默认提供者 ───────────────────────────────────────────────────────────

/**
 * 设置默认提供者。
 * - providerName === 'builtin'：清除 config.yaml 中所有自定义 provider 的 isDefault，
 *   并将内置 param 的 isDefault 设为 true（若无默认模型则自动选第一个可见模型）。
 * - 其他：将指定自定义 provider 的 isDefault 设为 true，清除其余 provider 的 isDefault，
 *   并清除内置 param 的 isDefault。
 */
export async function setDefaultProvider(
  tenantId: number,
  userId: number,
  providerName: string
): Promise<void> {
  if (providerName === 'builtin') {
    // 清除 config.yaml 中所有自定义 provider 的 isDefault
    const providers = config.modelProviders
    if (providers.some((p) => p.isDefault)) {
      providers.forEach((p) => {
        p.isDefault = false
      })
      syncConfigProviders()
    }
    // 设内置 param 为默认，若无默认模型则自动选第一个可见模型
    const builtinParam = await getBuiltinParam(tenantId, userId)
    builtinParam.isDefault = true
    if (!builtinParam.models.some((m) => m.isDefault)) {
      const firstVisible = builtinParam.models.find((m) => m.visible !== false)
      if (firstVisible) firstVisible.isDefault = true
    }
    await saveBuiltinParam(tenantId, userId, builtinParam)
  } else {
    // 设指定自定义 provider 为默认
    const providers = config.modelProviders
    providers.forEach((p) => {
      p.isDefault = p.name === providerName
    })
    syncConfigProviders()
    // 清除内置 param 的 isDefault
    const builtinParam = await getBuiltinParam(tenantId, userId)
    if (builtinParam.isDefault) {
      builtinParam.isDefault = false
      await saveBuiltinParam(tenantId, userId, builtinParam)
    }
  }
}

// ─── 设置默认模型 ─────────────────────────────────────────────────────────────

/**
 * 设置指定 provider 下的默认模型。
 * - providerName === 'builtin'：更新内置 param 中对应 model 的 isDefault，
 *   同时将内置 provider 设为默认提供者（并清除自定义 provider 的 isDefault）。
 * - 其他：目前自定义 provider 的默认模型通过 isDefault provider + models[0] 决定，
 *   此函数仅确保该 provider 被设为默认提供者。
 */
export async function setDefaultModel(
  tenantId: number,
  userId: number,
  providerName: string,
  modelName: string
): Promise<void> {
  if (providerName === 'builtin') {
    const builtinParam = await getBuiltinParam(tenantId, userId)
    // 更新模型的 isDefault
    const existing = builtinParam.models.find((m) => m.id === modelName)
    if (existing) {
      builtinParam.models.forEach((m) => {
        m.isDefault = m.id === modelName
      })
    } else {
      builtinParam.models.forEach((m) => {
        m.isDefault = false
      })
      builtinParam.models.push({
        id: modelName,
        visible: true,
        isDefault: true,
      })
    }
    // 同时将内置设为默认提供者
    if (!builtinParam.isDefault) {
      builtinParam.isDefault = true
      const providers = config.modelProviders
      if (providers.some((p) => p.isDefault)) {
        providers.forEach((p) => {
          p.isDefault = false
        })
        syncConfigProviders()
      }
    }
    await saveBuiltinParam(tenantId, userId, builtinParam)
  } else {
    // 自定义 provider：确保该 provider 被设为默认
    await setDefaultProvider(tenantId, userId, providerName)
  }
}

// ─── 同步内置 provider 模型列表 ───────────────────────────────────────────────

/**
 * 将远端拉取的内置模型列表（user.apiData.builtinModels）同步到 param 表。
 * 保留已有的用户偏好（visible、isDefault、temperature 等），仅补充新模型条目。
 * 若 param 中尚无任何默认模型，自动将第一个模型设为默认并将内置设为默认提供者。
 */
export async function syncBuiltinProvider(
  tenantId: number,
  userId: number,
  rawModels: Array<{ id?: string; name: string }>
): Promise<void> {
  if (!rawModels.length) return
  const builtinParam = await getBuiltinParam(tenantId, userId)
  const settingMap = new Map(builtinParam.models.map((m) => [m.id, m]))

  // 补充 param 中不存在的新模型
  for (const m of rawModels) {
    const modelId = (m.id ?? m.name) as string
    if (!settingMap.has(modelId)) {
      builtinParam.models.push({ id: modelId, visible: true, isDefault: false })
      settingMap.set(
        modelId,
        builtinParam.models[builtinParam.models.length - 1]
      )
    }
  }

  // 若没有任何默认模型，自动选第一个
  const hasDefault = builtinParam.models.some((m) => m.isDefault)
  if (!hasDefault && builtinParam.models.length > 0) {
    const firstVisible = builtinParam.models.find((m) => m.visible !== false)
    if (firstVisible) firstVisible.isDefault = true
  }

  await saveBuiltinParam(tenantId, userId, builtinParam)
}
