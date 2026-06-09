/**
 * Config API routes (model providers, embedding provider, llm, proxy)
 * Channel routes have been moved to @clawgoal/backend-claw → useClawRouter() (POST /claw/channel/*)
 */
import { Router } from 'express'
import { execFile } from 'child_process'
import fs from 'fs'
import { promisify } from 'util'
import { parseDocument } from 'yaml'
import {
  config,
  getConfigFilePath,
  normalizeProviderType,
  reloadConfig,
} from '../../config/index.js'
import { useI18n } from '../../locale/index.js'
import { resetEmbeddingProvider } from '../../model/embedding/sqliteVecProvider.js'
import { apiHandler } from '../../utils/api.js'
import { jsonStringify } from '../../utils/json.js'
import { error, success } from '../../utils/response.js'
import {
  webComponentDisabledMiddleware,
  supervisorMiddleware,
} from '../middlewares/auth.js'
import { ResponseCodes } from '../types/constants.js'

const execFileAsync = promisify(execFile)

const router = Router()

// ─── Model Provider ───────────────────────────────────────────────────────────

/**
 * @Api /api/config/modelProvider/get
 * @Summary Get config model provider
 * @ReturnDataExample {"modelProviders":[{"name":"openai","provider":"openai","apiBase":"https://api.openai.com/v1","apiKey":"sk-...","isDefault":true,"models":["gpt-4"]}]}
 */
router.post(
  '/config/modelProvider/get',
  supervisorMiddleware,
  apiHandler(async (_req, res) => {
    return success(res, {
      modelProviders: config.modelProviders.map((p) => ({
        name: p.name,
        provider: p.provider,
        format: p.format,
        apiBase: p.apiBase,
        apiKey: p.apiKey,
        isDefault: p.isDefault ?? false,
        proxyName: p.proxyName,
        models: p.models,
      })),
    })
  })
)

/**
 * @Api /api/config/modelProvider/save
 * @Summary Save config model provider
 * @BodyParam modelProviders array Array of model provider configs
 * @ReturnDataExample {"saved":true}
 */
router.post(
  '/config/modelProvider/save',
  supervisorMiddleware,
  webComponentDisabledMiddleware,
  apiHandler(async (req, res) => {
    const { t } = useI18n(req)
    const { modelProviders } = req.body as { modelProviders: any[] }

    if (
      Array.isArray(modelProviders) &&
      modelProviders.some((p) => p.name === 'default')
    ) {
      return error(
        res,
        ResponseCodes.DEFAULT_ERROR,
        t('modelProviderNameDefaultReserved')
      )
    }

    const configPath = getConfigFilePath()
    const rawContent = fs.readFileSync(configPath, 'utf-8')
    const doc = parseDocument(rawContent)

    doc.set(
      'modelProviders',
      modelProviders.map((p) => ({
        name: p.name,
        provider: p.provider,
        ...(p.format ? { format: p.format } : {}),
        apiBase: p.apiBase,
        apiKey: p.apiKey,
        ...(p.isDefault ? { isDefault: p.isDefault } : {}),
        ...(p.proxyName ? { proxyName: p.proxyName } : {}),
        models: (p.models as any[]).map((m) => ({
          name: m.name,
          ...(m.imageInputs && m.imageInputs.length > 0
            ? { imageInputs: m.imageInputs }
            : {}),
          ...(m.temperature !== undefined && m.temperature !== null
            ? { temperature: m.temperature }
            : {}),
          ...(m.maxTokens ? { maxTokens: m.maxTokens } : {}),
          ...(m.contextWindow ? { contextWindow: m.contextWindow } : {}),
        })),
      }))
    )

    // AUTO_TEST_MODE: skip writing to config file to avoid corrupting it
    if (process.env.AUTO_TEST_MODE !== '1') {
      fs.writeFileSync(configPath, doc.toString(), 'utf-8')
    }
    reloadConfig()
    return success(res, { saved: true })
  })
)

// ─── Embedding Model ──────────────────────────────────────────────────────────────────

/**
 * @Api /api/config/embeddingModel/get
 * @Summary Get config embedding model
 * @ReturnDataExample {"embeddingModel":{"type":"default"}}
 */
router.post(
  '/config/embeddingModel/get',
  supervisorMiddleware,
  apiHandler(async (_req, res) => {
    return success(res, {
      embeddingModel: config.embeddingModel ?? {
        type: 'default',
      },
    })
  })
)

/**
 * @Api /api/config/embeddingModel/save
 * @Summary Save config embedding model
 * @BodyParam embeddingModel object Embedding model config object
 * @ReturnDataExample {"saved":true}
 */
router.post(
  '/config/embeddingModel/save',
  supervisorMiddleware,
  webComponentDisabledMiddleware,
  apiHandler(async (req, res) => {
    const { embeddingModel } = req.body

    const configPath = getConfigFilePath()
    const rawContent = fs.readFileSync(configPath, 'utf-8')
    const doc = parseDocument(rawContent)

    doc.set('embeddingModel', embeddingModel)
    if (process.env.AUTO_TEST_MODE !== '1') {
      fs.writeFileSync(configPath, doc.toString(), 'utf-8')
    }
    reloadConfig()
    resetEmbeddingProvider() // 重置单例，下次调用 getEmbeddingProvider() 将使用新配置
    return success(res, { saved: true })
  })
)

// ─── Runtime Environment ──────────────────────────────────────────────────────

/**
 * @Api /api/config/runtime/get
 * @Summary Get config runtime
 * @ReturnDataExample {"runtime":{"python":{"path":"/usr/bin/python3","version":"3.11.0"}}}
 */
router.post(
  '/config/runtime/get',
  supervisorMiddleware,
  apiHandler(async (_req, res) => {
    return success(res, { runtime: config.runtime ?? {} })
  })
)

/**
 * @Api /api/config/runtime/detectVersion
 * @Summary Detect version config runtime
 * @BodyParam path string Path to the executable
 * @ReturnDataExample {"version":"3.11.0"}
 */
router.post(
  '/config/runtime/detectVersion',
  supervisorMiddleware,
  apiHandler(async (req, res) => {
    const { path: execPath } = req.body as { path: string }
    if (!execPath || typeof execPath !== 'string') {
      return error(res, ResponseCodes.BAD_REQUEST, 'path is required')
    }
    try {
      const { stdout } = await execFileAsync(execPath, ['--version'], {
        timeout: 5000,
      })
      const version = stdout.trim().replace(/^[^\d]*/, '')
      return success(res, { version })
    } catch (e: any) {
      // some runtimes (like node) write to stderr
      const stderr = e?.stderr?.trim() ?? ''
      if (stderr) {
        const version = stderr.replace(/^[^\d]*/, '')
        return success(res, { version })
      }
      return success(res, { version: '' })
    }
  })
)

/**
 * @Api /api/config/runtime/save
 * @Summary Save config runtime
 * @BodyParam runtime object Map of runtime configs keyed by type (e.g. python)
 * @ReturnDataExample {"saved":true}
 */
router.post(
  '/config/runtime/save',
  supervisorMiddleware,
  webComponentDisabledMiddleware,
  apiHandler(async (req, res) => {
    const { runtime } = req.body as {
      runtime: Record<string, { path: string; version?: string }>
    }

    const configPath = getConfigFilePath()
    const rawContent = fs.readFileSync(configPath, 'utf-8')
    const doc = parseDocument(rawContent)

    const runtimeYaml: Record<string, { path: string; version?: string }> = {}
    for (const [key, r] of Object.entries(runtime ?? {})) {
      runtimeYaml[key] = {
        path: r.path,
        ...(r.version ? { version: r.version } : {}),
      }
    }

    doc.set('runtime', runtimeYaml)
    if (process.env.AUTO_TEST_MODE !== '1') {
      fs.writeFileSync(configPath, doc.toString(), 'utf-8')
    }
    reloadConfig()
    return success(res, { saved: true })
  })
)

// ─── Model ────────────────────────────────────────────────────────────────────

/**
 * @Api /api/config/model/get
 * @Summary Get config model
 * @ReturnDataExample {"model":{"provider":"openai","name":"gpt-4"}}
 */
router.post(
  '/config/model/get',
  supervisorMiddleware,
  apiHandler(async (_req, res) => {
    return success(res, { model: config.model })
  })
)

/**
 * @Api /api/config/model/save
 * @Summary Save config model
 * @BodyParam model object Model config object
 * @ReturnDataExample {"saved":true}
 */
router.post(
  '/config/model/save',
  supervisorMiddleware,
  webComponentDisabledMiddleware,
  apiHandler(async (req, res) => {
    const { model } = req.body

    const configPath = getConfigFilePath()
    const rawContent = fs.readFileSync(configPath, 'utf-8')
    const doc = parseDocument(rawContent)

    doc.set('model', model)
    if (process.env.AUTO_TEST_MODE !== '1') {
      fs.writeFileSync(configPath, doc.toString(), 'utf-8')
    }
    reloadConfig()
    return success(res, { saved: true })
  })
)

/**
 * @Api /api/config/modelProvider/test
 * @Summary Test config model provider
 * @BodyParam provider string Provider type (e.g. openai, claude, gemini)
 * @BodyParam format string Optional format override
 * @BodyParam apiBase string API base URL
 * @BodyParam apiKey string API key
 * @BodyParam models string[] Model list
 * @ReturnDataExample {"ok":true}
 */
router.post(
  '/config/modelProvider/test',
  supervisorMiddleware,
  apiHandler(async (req, res) => {
    const {
      provider,
      format,
      apiBase,
      apiKey,
      models: _models,
    } = req.body as {
      provider: string
      format?: string
      apiBase: string
      apiKey: string
      models: string[]
    }

    // Normalize to canonical type for routing
    const effectiveType = normalizeProviderType(provider, format)
    const baseUrl = apiBase?.replace(/\/$/, '')

    try {
      if (effectiveType === 'claude') {
        // Anthropic: list models using x-api-key header
        const claudeBase = baseUrl || 'https://api.anthropic.com'
        const resp = await fetch(`${claudeBase}/v1/models`, {
          headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
          signal: AbortSignal.timeout(8000),
        })
        if (!resp.ok) {
          const text = await resp.text()
          throw new Error(`HTTP ${resp.status}: ${text.slice(0, 120)}`)
        }
      } else if (effectiveType === 'gemini') {
        // Gemini: list models with API key as query param
        const geminiBase = (
          baseUrl || 'https://generativelanguage.googleapis.com/v1beta'
        ).replace(/\/openai$/, '')
        const url = `${geminiBase}/models?key=${encodeURIComponent(apiKey)}`
        const resp = await fetch(url, { signal: AbortSignal.timeout(8000) })
        if (!resp.ok) {
          const text = await resp.text()
          throw new Error(`HTTP ${resp.status}: ${text.slice(0, 120)}`)
        }
      } else if (effectiveType === 'custom' && format === 'ollama') {
        // Ollama: check /api/tags (no auth required)
        const resp = await fetch(`${baseUrl}/api/tags`, {
          signal: AbortSignal.timeout(8000),
        })
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
      } else if (effectiveType === 'custom' && format === 'anthropic') {
        // Custom Anthropic-compatible endpoint: x-api-key header
        const resp = await fetch(`${baseUrl}/v1/models`, {
          headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
          signal: AbortSignal.timeout(8000),
        })
        if (!resp.ok) {
          const text = await resp.text()
          throw new Error(`HTTP ${resp.status}: ${text.slice(0, 120)}`)
        }
      } else {
        // OpenAI / OpenAI-compatible: try GET /models first, fallback to chat completion
        const modelsResp = await fetch(`${baseUrl}/models`, {
          headers: { Authorization: `Bearer ${apiKey}` },
          signal: AbortSignal.timeout(8000),
        })
        if (!modelsResp.ok) {
          // Fallback: some custom providers don't support /models listing,
          // but chat completions work fine — verify with a minimal request
          const testModel =
            _models && _models.length > 0 ? _models[0] : 'gpt-3.5-turbo'
          const chatResp = await fetch(`${baseUrl}/chat/completions`, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${apiKey}`,
              'Content-Type': 'application/json',
            },
            body: jsonStringify({
              model: testModel,
              messages: [{ role: 'user', content: 'hi' }],
              max_tokens: 1,
            }),
            signal: AbortSignal.timeout(15000),
          })
          if (!chatResp.ok) {
            const text = await chatResp.text()
            throw new Error(`HTTP ${chatResp.status}: ${text.slice(0, 120)}`)
          }
        }
      }
      return success(res, { ok: true })
    } catch (err: any) {
      return success(res, { ok: false, error: err?.message ?? String(err) })
    }
  })
)

/**
 * @Api /api/config/embeddingModel/test
 * @Summary Test config embedding model
 * @BodyParam type string Embedding model type (e.g. default, openai)
 * @BodyParam apiBase string Optional API base URL
 * @BodyParam apiKey string Optional API key
 * @ReturnDataExample {"ok":true}
 */
router.post(
  '/config/embeddingModel/test',
  supervisorMiddleware,
  apiHandler(async (req, res) => {
    const { type, apiBase, apiKey } = req.body as {
      type: string
      apiBase?: string
      apiKey?: string
    }

    if (type === 'default') {
      return success(res, { ok: true })
    }

    // OpenAI-compatible remote embedding
    try {
      const baseUrl = (apiBase || 'https://api.openai.com/v1').replace(
        /\/$/,
        ''
      )
      const resp = await fetch(`${baseUrl}/models`, {
        headers: { Authorization: `Bearer ${apiKey}` },
        signal: AbortSignal.timeout(8000),
      })
      if (!resp.ok) {
        const text = await resp.text()
        throw new Error(`HTTP ${resp.status}: ${text.slice(0, 120)}`)
      }
      return success(res, { ok: true })
    } catch (err: any) {
      return success(res, { ok: false, error: err?.message ?? String(err) })
    }
  })
)

export default router
