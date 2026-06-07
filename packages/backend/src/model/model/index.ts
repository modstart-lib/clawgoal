/**
 * Get Model configuration by name or user ID
 *
 * config.model is a named configuration map, where the key is the config name (e.g., "default", "router")
 * and the value is the corresponding Model configuration.
 *
 * - If name is provided and exists in config.model, return that configuration
 * - Otherwise return config.model['default'] (the default configuration)
 * - userId is reserved for future extension (e.g., reading user-defined configs from the database)
 *
 * @param _userId - User ID, reserved for future extension (e.g., reading user-defined configs from the database)
 * @param name - Named config key (e.g., "default", "router"), falls back to "default" if not found
 * @returns Model configuration
 */
import {
  AIMessage,
  BaseMessage,
  HumanMessage,
  SystemMessage,
  ToolMessage,
} from '@langchain/core/messages'
import { z } from 'zod'
import { zodToJsonSchema } from 'zod-to-json-schema'
import { getModelConfigList, ModelConfig } from '../../config'
import { logger } from '../../utils/logger'
import { jsonParse, jsonStringify } from '../../utils/json.js'
import { serializeModelInvokeError } from '../../utils/modelInvokeDebug'
import { insertModelLog } from '../../utils/modelLog.js'
import type { AgentContext, ToolContext } from '../../model/types'
import { generateId } from '../../utils/utils'
import { fetchImageAsDataUrl } from '../../utils/file'
import { createClaudeLangChainModel } from './claude'
import { createGeminiLangChainModel } from './custom'
import { createOpenAILangChainModel } from './openai'

export type { AgentContext, ToolContext } from '../../model/types'

/** Agent model slot reference (model name + optional overrides) */
export interface ModelRef {
  name: string | string[]
  temperature?: number
  maxTokens?: number
  systemPrompt?: string
}

/** Tool parameter schema (JSON Schema object type) */
export interface ToolParameterSchema {
  type: 'object'
  properties: Record<string, unknown>
  required?: string[]
}
/** Single tool call result */
export interface ModelToolCall {
  id: string
  name: string
  args: any
}

/**
 * Model return result type:
 * - json  — schema-validated JSON data
 * - tools — tool call request (caller executes and feeds results back)
 * - text  — plain text response
 */
export type ModelResult<T = any> =
  | { type: 'json'; data: T }
  | { type: 'tools'; tools: ModelToolCall[]; message: BaseMessage }
  | { type: 'text'; content: string; message: BaseMessage }

/** Options for modelCall */
export interface ModelCallOptions<T extends z.ZodType = any> {
  /** Tenant ID for model_log recording */
  tenantId: number
  /** User ID for model_log recording */
  userId: number
  /** Business domain identifier, used for model_log recording */
  biz: string
  /** Business entity ID (e.g. taskId, chatId), used for model_log recording */
  bizId: string

  schema?: T
  prompt?: string
  systemPrompt?: string
  userPrompt?: string
  appendMessages?: BaseMessage[]

  tools?: any[]
  temperature?: number
  maxRetry?: number
  /** 最大返回 token 数，优先级高于 modelConfigList 中的 maxTokens */
  maxTokens?: number
  context?: string

  logger?: any
  modelConfigList: ModelConfig[]

  onModelToolsStart?: (name: string, args: any) => void | Promise<void>
  onModelToolsEnd?: (
    name: string,
    status: 'success' | 'fail',
    result?: string,
    error?: string
  ) => void | Promise<void>
  onModelCallStart?: (model: string) => void | Promise<void>
  onModelCallEnd?: (
    model: string,
    status: 'success' | 'fail',
    duration?: number,
    usage?: {
      promptTokens?: number
      completionTokens?: number
      requestBody?: unknown
      responseBody?: unknown
    }
  ) => void | Promise<void>
}

/**
 * streamModel call options (schema not supported)
 */
interface ModelStreamOptions {
  tenantId: number
  userId: number
  biz: string // Business domain identifier
  bizId: string // Business entity ID

  prompt?: string
  systemPrompt?: string // System prompt
  userPrompt?: string // User prompt
  appendMessages?: BaseMessage[] // Additional messages to append
  tools?: any[] // Tool chain (supports LangChain tools)
  temperature?: number
  maxRetry?: number
  context?: string // Call context, used for logging
  logger?: any // Custom logger for recording requests and responses
  modelConfigList: ModelConfig[] // Custom Model configuration list; tried in order
  /** Model call end callback */
  onModelCallEnd?: (
    model: string,
    status: 'success' | 'fail',
    duration?: number,
    usage?: { requestBody?: unknown; responseBody?: unknown }
  ) => void | Promise<void>
}

/**
 * invokeModelWithTools call options
 */
interface ModelCallWithToolsOptions<T extends z.ZodType = any> {
  tenantId: number
  userId: number // User ID for retrieving user-defined Model config (modelConfigList takes priority)
  biz: string // Business domain identifier
  bizId: string // Business entity ID

  systemPrompt: string
  userPrompt: string
  tools: any[]
  schema?: T // Optional: if provided, waits for JSON; otherwise waits for text
  temperature?: number
  maxIterations?: number
  context: string
  logger?: any // Custom logger for recording requests and responses
  modelConfigList: ModelConfig[] // Custom Model configuration list; tried in order
  /** Optional agent context for each tool call. toolCallId is auto-generated per call. */
  toolContextBase?: AgentContext
  /** Tool call start callback */
  onModelToolsStart?: (name: string, args: any) => void | Promise<void>
  /** Tool call end callback */
  onModelToolsEnd?: (
    name: string,
    status: 'success' | 'fail',
    result?: string,
    error?: string
  ) => void | Promise<void>
  /** Model call start callback */
  onModelCallStart?: (model: string) => void | Promise<void>
  /** Model call end callback */
  onModelCallEnd?: (
    model: string,
    status: 'success' | 'fail',
    duration?: number,
    usage?: {
      promptTokens?: number
      completionTokens?: number
      requestBody?: unknown
      responseBody?: unknown
    }
  ) => void | Promise<void>
}

/**
 * invokeModelWithTools return result
 */
export interface ModelCallWithToolsResult<T = any> {
  data: T | null
  pending: boolean
  context?: {
    asksTool: ModelToolCall
    messages: BaseMessage[]
  }
}

/**
 * Generate an example JSON string from a Zod schema
 * Used to show the expected JSON format in prompts
 */
function generateSchemaExample(schema: z.ZodType): string {
  try {
    const jsonSchema = zodToJsonSchema(schema, {
      name: 'Response',
      $refStrategy: 'none',
    }) as any

    // Extract the actual object definition (strip $ref / $schema wrapper)
    const def = jsonSchema.definitions?.Response ?? jsonSchema

    function buildExample(s: any): any {
      if (!s || typeof s !== 'object') return null
      // 优先使用 schema 中定义的示例值或默认值
      if (s.examples && Array.isArray(s.examples) && s.examples.length > 0)
        return s.examples[0]
      if (s.default !== undefined) return s.default
      if (s.type === 'object' && s.properties) {
        const obj: any = {}
        for (const [key, val] of Object.entries<any>(s.properties)) {
          obj[key] = buildExample(val)
        }
        return obj
      }
      if (s.enum && Array.isArray(s.enum) && s.enum.length > 0) return s.enum[0]
      if (s.type === 'boolean') return true
      if (s.type === 'number') return 1
      if (s.type === 'string') return s.description || '示例值'
      if (s.type === 'array') return [buildExample(s.items)]
      return null
    }

    return jsonStringify(buildExample(def), 2)
  } catch (error: any) {
    logger.warn({ error: error.message }, 'Failed to generate schema example')
    return '{}'
  }
}

/**
 * Create the appropriate LangChain chat model based on ModelConfig.type.
 * Use in modelCall / modelStream instead of creating models directly.
 */
export function createLangChainModel(
  config: ModelConfig,
  streaming: boolean,
  temperature: number,
  maxTokens?: number
) {
  if (config.type === 'claude') {
    return createClaudeLangChainModel(config, streaming, temperature, maxTokens)
  }
  if (config.type === 'gemini') {
    return createGeminiLangChainModel(config, streaming, temperature, maxTokens)
  }
  // openai | custom (openai-compatible) — default
  return createOpenAILangChainModel(config, streaming, temperature, maxTokens)
}

/**
 * Create an Model model instance
 * @param streaming - Whether to enable streaming output
 * @param temperature - Temperature parameter
 * @param modelConfig - Model configuration; uses default env config if not provided
 */
export function modelCreate(
  streaming = false,
  temperature = 0.7,
  modelConfig: ModelConfig,
  maxTokens?: number
) {
  return createLangChainModel(modelConfig, streaming, temperature, maxTokens)
}

/**
 * Preprocess messages to convert image URLs to base64 when the model only supports base64 image inputs.
 * When imageInputs does not include 'url' but includes 'base64', remote URLs in image content parts
 * are fetched and converted to base64 data URIs.
 */
async function preprocessImageInputs(
  input: BaseMessage[] | string,
  imageInputs?: string[]
): Promise<BaseMessage[] | string> {
  if (typeof input === 'string') return input

  const needsUrlToBase64 =
    imageInputs &&
    !imageInputs.includes('url') &&
    imageInputs.includes('base64')

  const processed: BaseMessage[] = []
  for (const msg of input) {
    if (!Array.isArray(msg.content)) {
      processed.push(msg)
      continue
    }
    let modified = false
    const newContent = await Promise.all(
      (msg.content as any[]).map(async (part: any) => {
        if (
          part?.type === 'image_url' &&
          part?.image_url?.url &&
          typeof part.image_url.url === 'string'
        ) {
          const url: string = part.image_url.url
          // Fix data: URI with bad MIME, or convert remote URL to base64
          const isBadDataUri =
            url.startsWith('data:') &&
            (() => {
              const m = url.match(/^data:([^;]+);base64,/)
              return (
                m &&
                (m[1] === 'application/octet-stream' ||
                  !m[1].startsWith('image/'))
              )
            })()
          const isRemoteUrl = !url.startsWith('data:') && url.startsWith('http')
          if (isBadDataUri) {
            const fixed = await fetchImageAsDataUrl(url)
            if (fixed) {
              modified = true
              return { ...part, image_url: { url: fixed } }
            }
            return part
          }
          if (needsUrlToBase64 && isRemoteUrl) {
            const dataUrl = await fetchImageAsDataUrl(url)
            if (dataUrl) {
              modified = true
              return { ...part, image_url: { url: dataUrl } }
            }
            // Base64 conversion failed — drop the image part so the model
            // receives only the text and doesn't get a bare URL it can't handle.
            modified = true
            return null
          }
          return part
        }
        return part
      })
    )
    if (modified) {
      const MsgClass = msg.constructor as any
      const filteredContent = newContent.filter((p) => p !== null)
      const newMsg = new MsgClass({ content: filteredContent })
      processed.push(newMsg)
    } else {
      processed.push(msg)
    }
  }
  return processed
}

/**
 * Unified Model call method (with retry and logging)
 * Returns one of three possible result types:
 * - json: When schema is provided, returns validated JSON data
 * - tools: When Model requests tool calls, returns tool call info (handled by the outer business layer)
 * - text: Plain text response
 */
export async function modelCall<T extends z.ZodType = any>(
  options: ModelCallOptions<T>
): Promise<T extends z.ZodType ? ModelResult<z.infer<T>> : ModelResult> {
  const {
    schema,
    prompt,
    systemPrompt,
    userPrompt,
    appendMessages,
    tools,
    temperature = 0.7,
    maxTokens: callMaxTokens,
    context = 'Model',
    logger: customLogger,
    modelConfigList,
    biz,
    bizId,
    tenantId,
    userId,
    onModelCallStart,
    onModelCallEnd,
  } = options

  const logInstance = customLogger || logger

  // ── Build messages once — they are the same regardless of which config we use ──
  const finalMessages: BaseMessage[] = []
  let effectiveSystemPrompt = systemPrompt || ''

  if (schema) {
    const schemaExample = generateSchemaExample(schema)

    if (tools && tools.length > 0) {
      const instruction = `\n\nYou have two ways to respond:
1. If you need to call a tool to get information or perform an action, use the provided tools to call it.
2. If you do not need to call a tool, please return the result directly in JSON format, without including any other text, and only return a valid JSON object.

Example of the returned JSON format:
${schemaExample}`
      effectiveSystemPrompt = effectiveSystemPrompt
        ? effectiveSystemPrompt + instruction
        : instruction.trim()
    } else {
      const jsonInstruction = `\n\nYou must return the result in JSON format. Do not include any other text, only return a valid JSON object.\n\nExample of the returned JSON format:\n${schemaExample}`
      effectiveSystemPrompt = effectiveSystemPrompt
        ? effectiveSystemPrompt + jsonInstruction
        : jsonInstruction.trim()
    }
  }

  if (effectiveSystemPrompt) {
    finalMessages.push(new SystemMessage(effectiveSystemPrompt))
  }

  if (userPrompt) {
    finalMessages.push(new HumanMessage(userPrompt))
  }

  if (appendMessages && appendMessages.length > 0) {
    finalMessages.push(...appendMessages)
  }

  const input = finalMessages.length > 0 ? finalMessages : prompt || ''

  if (modelConfigList.length === 0) {
    throw new Error('Model.NotConfigured')
  }

  let lastError: Error | null = null
  const maxRetry = options.maxRetry ?? 3

  // ── Single loop: cycle through configs, total attempts = maxRetry ─────────────
  // If modelConfigList.length >= maxRetry: each config tried at most once (in order)
  // If modelConfigList.length < maxRetry:  cycle through the list until maxRetry total
  // Convert ToolDefinition[] to OpenAI function-calling format so LangChain
  // bindTools correctly includes the parameters schema in the API request.
  const openAiTools =
    tools && tools.length > 0
      ? tools.map((t: any) => ({
          type: 'function' as const,
          function: {
            name: t.name,
            description: t.description,
            parameters: t.parameters,
          },
        }))
      : null

  for (let attempt = 0; attempt < maxRetry; attempt++) {
    const configIndex = attempt % modelConfigList.length
    const modelConfig = modelConfigList[configIndex]!
    // Use per-model temperature/maxTokens if defined in model config, else fall back to call options
    const effectiveTemperature = modelConfig.temperature ?? temperature
    const effectiveMaxTokens = callMaxTokens ?? modelConfig.maxTokens
    const model = modelCreate(
      false,
      effectiveTemperature,
      modelConfig,
      effectiveMaxTokens
    )
    const modelWithTools = openAiTools ? model.bindTools(openAiTools) : model

    if (attempt > 0) {
      logInstance.debug(
        {
          context,
          retry: attempt,
          maxRetry,
          model: modelConfig.model,
          configIndex,
        },
        `Model.Retry #${attempt}/${maxRetry - 1}`
      )
    }

    logInstance.debug(
      {
        context,
        model: modelConfig.model,
        attempt: attempt + 1,
      },
      'Model.Request'
    )

    const startTime = Date.now()

    try {
      if (onModelCallStart) await onModelCallStart(modelConfig.model)

      const processedInput = await preprocessImageInputs(
        input,
        modelConfig.imageInputs
      )
      const response = await modelWithTools.invoke(processedInput as any)

      const duration = Date.now() - startTime
      const _usage = (response.usage_metadata ||
        response.response_metadata?.usage ||
        null) as {
        input_tokens?: number
        prompt_tokens?: number
        output_tokens?: number
        completion_tokens?: number
      } | null
      const _rawToolCalls =
        response.additional_kwargs?.tool_calls || response.tool_calls

      logInstance.debug(
        {
          context,
          attempt: attempt + 1,
          duration: `${duration}ms`,
        },
        'Model.Response'
      )

      if (onModelCallEnd) {
        const promptTokens =
          _usage?.input_tokens ?? _usage?.prompt_tokens ?? undefined
        const completionTokens =
          _usage?.output_tokens ?? _usage?.completion_tokens ?? undefined
        await onModelCallEnd(modelConfig.model, 'success', duration, {
          promptTokens,
          completionTokens,
          requestBody: {
            model: modelConfig.model,
            messages: finalMessages.map((m) => ({
              role: m._getType(),
              content: m.content,
            })),
            tools: openAiTools || undefined,
            temperature,
          },
          responseBody: {
            content: response.content,
            tool_calls: _rawToolCalls || undefined,
            usage: _usage || undefined,
          },
        })
      }

      if (biz) {
        const promptTokens = _usage?.input_tokens ?? _usage?.prompt_tokens ?? 0
        const completionTokens =
          _usage?.output_tokens ?? _usage?.completion_tokens ?? 0
        insertModelLog({
          tenantId,
          userId,
          name: modelConfig.name,
          provider: modelConfig.type,
          model: modelConfig.model,
          messageCount: finalMessages.length,
          promptTokens,
          completionTokens,
          totalTokens: promptTokens + completionTokens,
          durationMs: duration,
          status: 'success',
          biz,
          bizId,
          requestBody: {
            model: modelConfig.model,
            messages: finalMessages.map((m) => ({
              role: m._getType(),
              content: m.content,
            })),
            tools: openAiTools || undefined,
            temperature,
          },
          responseBody: {
            content: response.content,
            tool_calls: _rawToolCalls || undefined,
            usage: _usage || undefined,
          },
        })
      }

      const toolCalls = _rawToolCalls

      if (toolCalls && toolCalls.length > 0) {
        const tools: ModelToolCall[] = toolCalls.map((tc: any) => ({
          id: tc.id || generateId(),
          name: tc.function?.name || tc.name,
          args:
            typeof tc.function?.arguments === 'string'
              ? jsonParse(tc.function.arguments)
              : tc.function?.arguments || tc.args,
        }))

        logInstance.debug(
          {
            context,
            attempt: attempt + 1,
            duration: `${duration}ms`,
            toolsCount: tools.length,
          },
          'Model.Response.Success.WithTools'
        )

        return { type: 'tools', tools, message: response } as any
      }

      if (schema) {
        try {
          const content = response.content.toString()
          let jsonData: any

          try {
            jsonData = jsonParse(content)
          } catch (parseError) {
            const jsonMatch =
              content.match(/```json\s*([\s\S]*?)\s*```/) ||
              content.match(/```\s*([\s\S]*?)\s*```/)
            if (jsonMatch) {
              jsonData = jsonParse(jsonMatch[1])
            } else {
              throw parseError
            }
          }

          const validatedData = schema.parse(jsonData)

          logInstance.debug(
            { context, attempt: attempt + 1, duration: `${duration}ms` },
            'Model.Response.Success.WithSchema'
          )

          return { type: 'json', data: validatedData } as any
        } catch (error: any) {
          logInstance.error(
            {
              context,
              error: error.message,
              content: response.content.toString(),
            },
            'Model.Response.SchemaValidationFailed'
          )
          throw new Error(`Schema validation failed: ${error.message}`)
        }
      }

      logInstance.debug(
        { context, attempt: attempt + 1, duration: `${duration}ms` },
        'Model.Response.Success'
      )
      return {
        type: 'text',
        content: response.content.toString(),
        message: response,
      } as any
    } catch (error: any) {
      lastError = error

      if (onModelCallEnd) await onModelCallEnd(modelConfig.model, 'fail')

      if (biz) {
        insertModelLog({
          tenantId,
          userId,
          name: modelConfig.name,
          provider: modelConfig.type,
          model: modelConfig.model,
          messageCount: finalMessages.length,
          durationMs: Date.now() - startTime,
          status: 'error',
          error: error.message,
          biz,
          bizId,
        })
      }

      logInstance.debug(
        {
          context,
          attempt: attempt + 1,
          maxRetry,
          model: modelConfig.model,
          error: error.message,
          stack: error.stack,
        },
        `Model.Response.Failed.Try${attempt + 1}`
      )
      logInstance.warn(
        {
          context,
          attempt: attempt + 1,
          model: modelConfig.model,
          errorDetails: serializeModelInvokeError(error),
        },
        'Model.Response.Failed.Details'
      )

      if (attempt < maxRetry - 1) {
        const delay = Math.min(1000 * Math.pow(2, attempt), 10000) // exponential backoff, max 10 seconds
        logInstance.debug({ delay: `${delay}ms` }, `Model.Response.Wait`)
        await new Promise((resolve) => setTimeout(resolve, delay))
      }
    }
  }

  logInstance.error(
    {
      context,
      totalConfigs: modelConfigList.length,
      maxRetry,
      error: lastError?.message,
      stack: lastError?.stack,
      errorDetails: lastError
        ? serializeModelInvokeError(lastError)
        : undefined,
    },
    'Model.Response.FinalFailed'
  )

  throw lastError || new Error('Model.CallFailed')
}

/**
 * Streaming Model call (with retry and logging)
 * Note: Streaming does not support schema or tool call scenarios; use invokeModel for those cases
 */
export async function modelStream(
  options: ModelStreamOptions
): Promise<AsyncIterable<any>> {
  if (process.env.MOCK_LLM === '1') {
    async function* mockStream() {
      yield { content: '[mock stream]' }
    }
    return mockStream()
  }
  const {
    prompt,
    systemPrompt,
    userPrompt,
    appendMessages,
    temperature = 0.7,
    context = 'Model.Stream',
    logger: customLogger,
    modelConfigList,
    biz,
    bizId,
    tenantId,
    userId,
    onModelCallEnd,
  } = options

  const logInstance = customLogger || logger

  const finalMessages: BaseMessage[] = []
  if (systemPrompt) {
    finalMessages.push(new SystemMessage(systemPrompt))
  }
  if (userPrompt) {
    finalMessages.push(new HumanMessage(userPrompt))
  }
  if (appendMessages && appendMessages.length > 0) {
    finalMessages.push(...appendMessages)
  }
  const input = finalMessages.length > 0 ? finalMessages : prompt || ''

  if (modelConfigList.length === 0) {
    throw new Error('Model.NotConfigured')
  }

  let lastError: Error | null = null
  const maxRetry = options.maxRetry ?? 3

  // ── Single loop: cycle through configs, total attempts = maxRetry ─────────────
  // If modelConfigList.length >= maxRetry: each config tried at most once (in order)
  // If modelConfigList.length < maxRetry:  cycle through the list until maxRetry total
  for (let attempt = 0; attempt < maxRetry; attempt++) {
    const configIndex = attempt % modelConfigList.length
    const modelConfig = modelConfigList[configIndex]!
    const effectiveTemperature = modelConfig.temperature ?? temperature
    const effectiveMaxTokens = modelConfig.maxTokens
    const model = modelCreate(
      true,
      effectiveTemperature,
      modelConfig,
      effectiveMaxTokens
    )

    if (attempt > 0) {
      logInstance.debug(
        {
          context,
          retry: attempt,
          maxRetry,
          model: modelConfig.model,
          configIndex,
        },
        `Model.Stream.Retry #${attempt}/${maxRetry - 1}`
      )
    }

    logInstance.debug(
      {
        context,
        model: modelConfig.model,
        attempt: attempt + 1,
      },
      'Model.Stream.Request'
    )

    try {
      const startTime = Date.now()

      const processedInput = await preprocessImageInputs(
        input,
        modelConfig.imageInputs
      )
      const stream = await model.stream(processedInput as any)

      const duration = Date.now() - startTime

      logInstance.debug(
        {
          context,
          attempt: attempt + 1,
          duration: `${duration}ms`,
        },
        'Model.Stream.Start'
      )

      const streamStartTime = Date.now()
      let fullContent = ''
      const wrappedStream = (async function* () {
        try {
          for await (const chunk of stream) {
            fullContent += chunk.content || ''
            yield chunk
          }
          logInstance.debug(
            {
              context,
              totalLength: fullContent.length,
            },
            'Model.Stream.End'
          )
          if (onModelCallEnd) {
            await onModelCallEnd(
              modelConfig.model,
              'success',
              Date.now() - streamStartTime,
              {
                requestBody: {
                  model: modelConfig.model,
                  messages: finalMessages.map((m) => ({
                    role: m._getType(),
                    content: m.content,
                  })),
                  temperature,
                },
                responseBody: {
                  content: fullContent,
                },
              }
            )
          }
          insertModelLog({
            tenantId,
            userId,
            name: modelConfig.name,
            provider: modelConfig.type,
            model: modelConfig.model,
            messageCount: finalMessages.length,
            durationMs: Date.now() - streamStartTime,
            status: 'success',
            biz,
            bizId,
            requestBody: {
              model: modelConfig.model,
              messages: finalMessages.map((m) => ({
                role: m._getType(),
                content: m.content,
              })),
              temperature,
            },
            responseBody: {
              content: fullContent,
            },
          })
        } catch (error: any) {
          logInstance.error(
            {
              context,
              error: error.message,
              errorDetails: serializeModelInvokeError(error),
            },
            'Model.Stream.ErrorDuringStream'
          )
          if (onModelCallEnd) {
            await onModelCallEnd(modelConfig.model, 'fail')
          }
          insertModelLog({
            tenantId,
            userId,
            name: modelConfig.name,
            provider: modelConfig.type,
            model: modelConfig.model,
            messageCount: finalMessages.length,
            durationMs: Date.now() - streamStartTime,
            status: 'error',
            error: error.message,
            biz,
            bizId,
          })
          throw error
        }
      })()

      return wrappedStream
    } catch (error: any) {
      lastError = error

      logInstance.debug(
        {
          context,
          attempt: attempt + 1,
          maxRetry,
          model: modelConfig.model,
          error: error.message,
          stack: error.stack,
        },
        `Model.Stream.Failed.Try${attempt + 1}`
      )
      logInstance.warn(
        {
          context,
          attempt: attempt + 1,
          model: modelConfig.model,
          errorDetails: serializeModelInvokeError(error),
        },
        'Model.Stream.Failed.Details'
      )

      if (attempt < maxRetry - 1) {
        const delay = Math.min(1000 * Math.pow(2, attempt), 10000)
        logInstance.debug({ delay: `${delay}ms` }, `Model.Stream.Wait`)
        await new Promise((resolve) => setTimeout(resolve, delay))
      }
    }
  }

  logInstance.error(
    {
      context,
      totalConfigs: modelConfigList.length,
      maxRetry,
      error: lastError?.message,
      stack: lastError?.stack,
      errorDetails: lastError
        ? serializeModelInvokeError(lastError)
        : undefined,
    },
    'Model.Stream.FinalFailed'
  )

  throw lastError || new Error('Model.StreamCallFailed')
}

/**
 * Check whether the tool call array contains a tool with the specified name
 * @param toolCalls - Array of tool call information
 * @param toolName - Tool name to check
 * @returns The tool call object if found, otherwise undefined
 */
export function hasTool(
  toolCalls: ModelToolCall[],
  toolName: string
): ModelToolCall | undefined {
  return toolCalls.find((tc) => tc.name === toolName)
}

/**
 * Execute tool calls and return an array of ToolMessages
 * Used by the outer business layer to handle tool calls
 *
 * @param toolCalls - Array of tool call information
 * @param tools - List of available tools
 * @param context - Logging context
 * @param customLogger - Custom logger
 * @param onModelToolsStart - Tool call start callback
 * @param onModelToolsEnd - Tool call end callback
 * @returns Array of ToolMessages, ready to be appended to message history
 */
export async function executeToolCalls(
  toolCalls: ModelToolCall[],
  tools: any[],
  context = 'ToolExecution',
  customLogger?: any,
  onModelToolsStart?: (name: string, args: any) => void | Promise<void>,
  onModelToolsEnd?: (
    name: string,
    status: 'success' | 'fail',
    result?: string,
    error?: string
  ) => void | Promise<void>,
  toolContextBase?: AgentContext
): Promise<ToolMessage[]> {
  const logInstance = customLogger || logger

  // Execute all tool calls in parallel (independent calls issued by the Model in one response)
  const toolMessages = await Promise.all(
    toolCalls.map(async (toolCall): Promise<ToolMessage> => {
      const { id, name, args } = toolCall

      // Build per-call ToolContext with a freshly generated toolCallId
      const toolContext: ToolContext | undefined = toolContextBase
        ? { agentContext: toolContextBase, toolCallId: id || generateId() }
        : undefined

      // Trigger tool call start callback
      if (onModelToolsStart) await onModelToolsStart(name, args)

      try {
        const tool = tools.find((t) => t.name === name)
        if (!tool) {
          logInstance.warn({ toolName: name, context }, 'Tool.NotFound')
          const errorMsg = `Tool ${name} not found`
          if (onModelToolsEnd)
            await onModelToolsEnd(name, 'fail', undefined, errorMsg)
          return new ToolMessage({
            tool_call_id: id,
            content: jsonStringify({ success: false, error: errorMsg }),
          })
        }
        logInstance.info({ context, toolName: name }, 'Tool.Calling')
        const result = toolContext
          ? await tool.func(args, toolContext)
          : await tool.func(args)
        const resultContent =
          typeof result === 'string' ? result : jsonStringify(result)
        logInstance.info({ context, toolName: name }, 'Tool.Result')
        if (onModelToolsEnd)
          await onModelToolsEnd(name, 'success', resultContent, undefined)
        return new ToolMessage({
          tool_call_id: id,
          content: resultContent,
        })
      } catch (error: any) {
        logInstance.error(
          { toolName: name, error: error.message, context },
          'Tool.Error'
        )
        if (onModelToolsEnd)
          await onModelToolsEnd(name, 'fail', undefined, error.message)
        return new ToolMessage({
          tool_call_id: id,
          content: jsonStringify({ success: false, error: error.message }),
        })
      }
    })
  )

  return toolMessages
}

/**
 * Iterative Model execution with tool calls
 * Encapsulates the tool call loop logic and automatically handles the special case of the asks tool
 *
 * @returns
 * - pending=false: Result obtained successfully (JSON or text), data contains the result
 * - pending=true: Encountered asks tool requiring user input, context contains asksTool and messages
 */
export async function modelCallWithTools<T extends z.ZodType = any>(
  options: ModelCallWithToolsOptions<T>
): Promise<
  ModelCallWithToolsResult<T extends z.ZodType ? z.infer<T> : string>
> {
  const {
    systemPrompt,
    userPrompt,
    tools,
    schema,
    temperature = 0.7,
    maxIterations = 10,
    context: contextName,
    logger: customLogger,
    modelConfigList,
    biz,
    bizId,
    tenantId,
    userId,
    toolContextBase,
    onModelToolsStart,
    onModelToolsEnd,
    onModelCallStart,
    onModelCallEnd,
  } = options

  // Build resolved tool context base (merge provided base with userId/tenantId from options)
  const resolvedToolContextBase: AgentContext = {
    userId,
    tenantId,
    ...toolContextBase,
  }

  const messages: BaseMessage[] = []

  for (let iteration = 0; iteration < maxIterations; iteration++) {
    const result = await modelCall({
      systemPrompt: iteration === 0 ? systemPrompt : undefined,
      userPrompt: iteration === 0 ? userPrompt : undefined,
      appendMessages: iteration > 0 ? messages : undefined,
      tools,
      schema,
      temperature,
      context: contextName,
      logger: customLogger,
      modelConfigList,
      tenantId,
      userId,
      biz,
      bizId,
      onModelCallStart,
      onModelCallEnd,
    })

    if (result.type === 'json') {
      return { data: result.data, pending: false }
    } else if (result.type === 'text') {
      return { data: result.content as any, pending: false }
    } else if (result.type === 'tools') {
      const asksTool = hasTool(result.tools, 'asks')
      if (asksTool) {
        return {
          data: null,
          pending: true,
          context: {
            asksTool,
            messages: [...messages, result.message],
          },
        }
      }
      messages.push(result.message)
      const toolMessages = await executeToolCalls(
        result.tools,
        tools,
        contextName,
        customLogger,
        onModelToolsStart,
        onModelToolsEnd,
        resolvedToolContextBase
      )
      messages.push(...toolMessages)
    } else {
      throw new Error('Failed to get expected result')
    }
  }

  throw new Error('Maximum tool call iteration count reached')
}

// ─── Model reference resolution ──────────────────────────────────────────────

/**
 * Read a param stored in the database (by paramName) and resolve it to an ordered
 * ModelConfig list suitable for passing to modelCall.
 * Falls back to the default model config list if the param is absent or unresolvable.
 * Supports builtin model references.
 */
export async function resolveModelConfigListByParamName(
  paramDb: {
    getParam(
      tenantId: number,
      userId: number,
      name: string
    ): Promise<string | null | undefined>
  },
  tenantId: number,
  userId: number,
  paramName: string
): Promise<ModelConfig[]> {
  try {
    const ref = await paramDb.getParam(tenantId, userId, paramName)
    if (ref && ref.trim()) {
      const cfgList = await getModelConfigList(userId, tenantId, ref.trim())
      if (cfgList.length > 0) return cfgList
    }
  } catch {
    // ignore, fall through to default
  }
  return getModelConfigList(userId, tenantId, 'default')
}

/**
 * Resolve the model reference for an agent, given an optional slot name.
 * Returns { modelRef, modelConfigs } where modelConfigs is the ordered list
 * of candidates to pass to modelCall (it handles retries internally).
 * Supports builtin model references.
 */
export async function resolveAgentModelListByRef(
  agent: {
    userId: number
    tenantId: number
    config: {
      models?: Record<string, any>
      model: { temperature?: number; maxTokens?: number }
    }
  },
  slot = 'default'
): Promise<{ modelRef: ModelRef; modelConfigs: ModelConfig[] }> {
  const slots = agent.config.models
  const raw = slots?.[slot] ?? slots?.['default']
  const slotRef: ModelRef | undefined =
    typeof raw === 'string' ? { name: raw } : (raw as ModelRef | undefined)

  const nameOrNames = slotRef?.name ?? 'default'
  const names: string[] = Array.isArray(nameOrNames)
    ? nameOrNames
    : [nameOrNames]

  const temperature = slotRef?.temperature ?? agent.config.model.temperature
  const maxTokens = slotRef?.maxTokens ?? agent.config.model.maxTokens
  const systemPrompt = slotRef?.systemPrompt

  const modelRef: ModelRef = {
    name: nameOrNames,
    temperature,
    maxTokens,
    systemPrompt,
  }

  const modelConfigs: ModelConfig[] = []
  for (const refName of names) {
    try {
      const cfgList = await getModelConfigList(
        agent.userId,
        agent.tenantId,
        refName
      )
      if (cfgList.length > 0) modelConfigs.push(...cfgList)
    } catch (e) {
      logger.warn(`Cannot resolve model "${refName}" for slot "${slot}": ${e}`)
    }
  }

  if (modelConfigs.length === 0) {
    const fallback = await getModelConfigList(
      agent.userId,
      agent.tenantId,
      'default'
    )
    modelConfigs.push(...fallback)
  }
  return { modelRef, modelConfigs }
}
