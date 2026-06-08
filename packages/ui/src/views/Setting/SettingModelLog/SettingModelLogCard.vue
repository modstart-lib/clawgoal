<script setup lang="ts">
import { type ModelLogRecord } from '@/api/modelLog'
import { shareUserTempLink } from '@/api/userTempFile'
import JSONViewer from '@/components/JSONViewer.vue'
import { copyText, safeJsonParse } from '@/utils/utils'
import {
  Braces,
  Calendar,
  ChevronDown,
  ChevronRight,
  Clock,
  Code,
  Copy,
  Cpu,
  Database,
  FileJson,
  Link,
  MessageCircle,
  MessageSquare,
  Terminal,
  Wrench,
  Zap,
} from 'lucide-vue-next'
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import SettingModelLogToolsModal from './SettingModelLogToolsModal.vue'

const { t } = useI18n()

const props = defineProps<{
  record: ModelLogRecord
}>()

const expanded = ref(false)
const toolsModalVisible = ref(false)
const toolsModalData = ref<
  Array<{ name: string; description?: string; parameters?: any }>
>([])

function getToolsDetail(req: any) {
  if (!req || !Array.isArray(req.tools)) return []
  return req.tools
    .filter((t: any) => t.function?.name)
    .map((t: any) => ({
      name: t.function.name,
      description: t.function.description,
      parameters: t.function.parameters,
    }))
}

function openToolsModal(req: any, e: Event) {
  e.stopPropagation()
  toolsModalData.value = getToolsDetail(req)
  toolsModalVisible.value = true
}

function parseModelRequest(str: string | null) {
  if (!str) return null
  return safeJsonParse(str, [])
}

function getSystemPrompt(req: any) {
  if (!req || !Array.isArray(req.messages)) return null
  const sysMsg = req.messages.find((m: any) => m.role === 'system')
  return sysMsg ? sysMsg.content : null
}

function getUserMessages(req: any): Array<{ role: string; content: string }> {
  if (!req || !Array.isArray(req.messages)) return []
  return req.messages
    .filter((m: any) => m.role !== 'system' && typeof m.content === 'string')
    .map((m: any) => ({ role: m.role, content: m.content }))
}

function getTools(req: any): string[] {
  if (!req || !Array.isArray(req.tools)) return []
  return req.tools.map((t: any) => t.function?.name).filter(Boolean)
}

function getToolCalls(resStr: string | null) {
  if (!resStr) return null
  const res = safeJsonParse(resStr, {} as any)
  if (res.tool_calls && res.tool_calls.length > 0) {
    return res.tool_calls.map((tc: any) => ({
      name: tc.function?.name || tc.name,
      arguments: tc.function?.arguments || tc.args,
    }))
  }
  const msg = res.choices?.[0]?.message
  if (msg?.tool_calls) {
    return msg.tool_calls.map((tc: any) => ({
      name: tc.function?.name,
      arguments: tc.function?.arguments,
    }))
  }
  return null
}

function getResponseText(resStr: string | null): string | null {
  if (!resStr) return null
  const res = safeJsonParse(resStr, {} as any)
  if ('content' in res) {
    if (typeof res.content === 'string') return res.content || null
    if (Array.isArray(res.content)) {
      const texts = res.content
        .filter((c: any) => c.type === 'text')
        .map((c: any) => c.text)
        .join('')
      return texts || null
    }
  }
  return res.choices?.[0]?.message?.content ?? null
}

function getLastRequestMessage(
  req: any
): { type: 'user' | 'tool'; content: string } | null {
  if (!req || !Array.isArray(req.messages)) return null
  for (let i = req.messages.length - 1; i >= 0; i--) {
    const m = req.messages[i]
    if (m.role === 'user' || m.role === 'human') {
      const content = typeof m.content === 'string' ? m.content : ''
      if (content) return { type: 'user', content }
    }
    if (m.role === 'tool') {
      const content =
        typeof m.content === 'string'
          ? m.content
          : JSON.stringify(m.content ?? '')
      return { type: 'tool', content }
    }
  }
  return null
}

const sharing = ref(false)

async function handleShare() {
  const data = {
    id: props.record.id,
    status: props.record.status,
    biz: props.record.biz,
    bizId: props.record.bizId,
    name: props.record.name,
    provider: props.record.provider,
    model: props.record.model,
    durationMs: props.record.durationMs,
    promptTokens: props.record.promptTokens,
    completionTokens: props.record.completionTokens,
    totalTokens: props.record.totalTokens,
    error: props.record.error,
    createdAt: props.record.createdAt,
    request: parseModelRequest(props.record.requestBody),
    response: props.record.responseBody
      ? (() => {
          return safeJsonParse(props.record.responseBody, {} as any)
        })()
      : null,
  }
  sharing.value = true
  await shareUserTempLink({
    content: JSON.stringify(data, null, 2),
    ext: 'json',
  })
  sharing.value = false
}
</script>

<template>
  <div
    class="bg-white rounded-lg border border-gray-100 hover:shadow-md transition"
  >
    <!-- 卡片头部 -->
    <div
      class="px-4 pt-3 pb-2 border-b border-gray-100 cursor-pointer flex flex-col gap-1.5"
      @click="expanded = !expanded"
    >
      <!-- 第一行：标签 + 统计信息 -->
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2 flex-wrap">
          <span class="text-xs font-mono text-gray-500"
            >#{{ props.record.id }}</span
          >
          <a-tag
            :color="props.record.status === 'success' ? 'success' : 'error'"
            class="!mr-0"
          >
            {{ props.record.status }}
          </a-tag>
          <a-tag v-if="props.record.biz" color="blue" class="!mr-0"
            >{{ props.record.biz }}:{{ props.record.bizId }}</a-tag
          >
        </div>
        <div
          class="flex items-center gap-4 text-xs text-gray-500 flex-shrink-0"
        >
          <span class="flex items-center gap-1 font-medium text-gray-700">
            <Cpu class="w-3.5 h-3.5" />
            {{ props.record.name || '-' }} /
            {{ props.record.provider || 'N/A' }} / {{ props.record.model }}
          </span>
          <span class="flex items-center gap-1">
            <Clock class="w-3.5 h-3.5" />
            {{ props.record.durationMs }} ms
          </span>
          <span
            class="flex items-center gap-1"
            title="Tokens: Total (Prompt / Completion)"
          >
            <Database class="w-3.5 h-3.5" />
            {{ props.record.totalTokens }} ({{ props.record.promptTokens }} /
            {{ props.record.completionTokens }})
          </span>
          <span class="flex items-center gap-1 text-gray-400">
            <Calendar class="w-3.5 h-3.5" />
            {{ props.record.createdAt }}
          </span>
          <a-button
            class="inline-flex items-center"
            :loading="sharing"
            :title="t('settingModelLog.cardShareTitle')"
            @click.stop="handleShare"
          >
            <Link class="w-4 h-4" aria-hidden="true" />
          </a-button>
          <ChevronDown v-if="expanded" class="w-4 h-4 ml-auto text-gray-400" />
          <ChevronRight v-else class="w-4 h-4 ml-auto text-gray-400" />
        </div>
      </div>
      <!-- 第二行：最近一次输入内容 -->
      <template
        v-for="(msg, index) in [
          getLastRequestMessage(parseModelRequest(props.record.requestBody)),
        ]"
        :key="index"
      >
        <div
          v-if="msg"
          class="flex items-center gap-1.5 text-xs text-gray-500 min-w-0"
        >
          <MessageCircle
            v-if="msg.type === 'user'"
            class="w-3.5 h-3.5 shrink-0 text-blue-400"
            aria-hidden="true"
          />
          <Wrench
            v-else
            class="w-3.5 h-3.5 shrink-0 text-amber-400"
            aria-hidden="true"
          />
          <span class="truncate">{{ msg.content.slice(0, 200) }} </span>
        </div>
      </template>
    </div>

    <!-- 请求与返回两栏 - 展开时显示 -->
    <div v-if="expanded" class="grid grid-cols-2 divide-x divide-gray-100">
      <!-- 左侧：解析后的易读数据 -->
      <div class="p-4 flex flex-col gap-4" @click.stop>
        <div>
          <div
            class="flex items-center gap-1.5 text-xs font-semibold text-gray-400 mb-2 uppercase tracking-wide"
          >
            <Braces class="w-4 h-4" /> {{ t('settingModelLog.cardRequest') }}
          </div>
          <template
            v-for="(req, _idx) in [parseModelRequest(props.record.requestBody)]"
            :key="_idx"
          >
            <template v-if="req">
              <div
                v-if="getTools(req).length > 0"
                class="mb-2 flex items-center gap-1 overflow-hidden cursor-pointer hover:bg-gray-50 rounded px-1 -mx-1 transition group"
                @click="openToolsModal(req, $event)"
              >
                <Wrench class="w-3 h-3 text-gray-400 shrink-0" />
                <span class="text-[10px] text-gray-400 shrink-0">{{
                  t('settingModelLog.cardTools')
                }}</span>
                <span class="text-[10px] text-gray-500 truncate">{{
                  getTools(req).join(', ')
                }}</span>
                <span class="text-[10px] text-gray-400 shrink-0 mr-1"
                  >({{ getTools(req).length }})</span
                >
                <span
                  class="text-[10px] text-indigo-400 opacity-0 group-hover:opacity-100 transition shrink-0"
                  >{{ t('settingModelLog.cardClickToView') }}</span
                >
              </div>
              <div v-if="getUserMessages(req).length > 0" class="mb-2">
                <div
                  class="flex items-center gap-1 text-[10px] text-gray-400 mb-0.5"
                >
                  <MessageSquare class="w-3 h-3" />
                  {{
                    t('settingModelLog.cardMessages', {
                      count: getUserMessages(req).length,
                    })
                  }}
                </div>
                <div class="max-h-[20vh] overflow-auto">
                  <div
                    v-for="(msg, idx) in getUserMessages(req)"
                    :key="idx"
                    class="text-xs text-gray-600 bg-gray-50 p-1.5 rounded border border-gray-200 mb-1 relative group"
                  >
                    <Copy
                      class="absolute top-1.5 right-1.5 w-3.5 h-3.5 text-gray-400 cursor-pointer hover:text-gray-600 opacity-0 group-hover:opacity-100 transition-opacity"
                      @click.stop="copyText(msg.content)"
                    />
                    <span class="font-semibold text-gray-500 mr-1"
                      >{{ msg.role }}:</span
                    >
                    <span class="whitespace-pre-wrap">{{ msg.content }}</span>
                  </div>
                </div>
              </div>
              <div v-if="getSystemPrompt(req)" class="mb-2 relative group">
                <div
                  class="flex items-center gap-1 text-[10px] text-gray-400 mb-0.5"
                >
                  <Terminal class="w-3 h-3" /> System Prompt
                </div>
                <Copy
                  class="absolute top-0 right-0 w-3.5 h-3.5 text-gray-400 cursor-pointer hover:text-gray-600 opacity-0 group-hover:opacity-100 transition-opacity"
                  @click.stop="copyText(getSystemPrompt(req))"
                />
                <div
                  class="text-xs text-gray-600 bg-gray-50 p-2 rounded border border-gray-200 whitespace-pre-wrap max-h-[20vh] overflow-auto"
                >
                  {{ getSystemPrompt(req) }}
                </div>
              </div>
            </template>
          </template>
        </div>

        <div>
          <div
            class="flex items-center gap-1.5 text-xs font-semibold text-gray-400 mb-2 uppercase tracking-wide border-t border-gray-100 pt-3"
          >
            <Code class="w-4 h-4" /> {{ t('settingModelLog.cardResponse') }}
          </div>
          <div
            v-if="props.record.error"
            class="mb-2 p-2 bg-red-50 border border-red-200 text-red-600 rounded text-xs"
          >
            <strong>{{ t('settingModelLog.cardError') }}</strong
            >{{ props.record.error }}
          </div>
          <template
            v-for="(calls, _idx) in [getToolCalls(props.record.responseBody)]"
            :key="_idx"
          >
            <div v-if="calls && calls.length > 0" class="mb-2">
              <div
                class="flex items-center gap-1 text-[10px] text-gray-400 mb-0.5"
              >
                <Wrench class="w-3 h-3" /> Tool Calls
              </div>
              <div
                v-for="(call, idx) in calls"
                :key="idx"
                class="bg-purple-50 p-2 rounded mb-1 border border-purple-100 relative group"
              >
                <Copy
                  class="absolute top-1.5 right-1.5 w-3.5 h-3.5 text-purple-400 cursor-pointer hover:text-purple-600 opacity-0 group-hover:opacity-100 transition-opacity z-10"
                  @click.stop="copyText(JSON.stringify(call, null, 2))"
                />
                <div
                  class="flex items-center gap-1 font-medium text-purple-700 text-xs mb-1"
                >
                  <Zap class="w-3.5 h-3.5 text-purple-500" />
                  {{ call.name }}
                </div>
                <JSONViewer
                  :value="call.arguments"
                  max-height="150px"
                  size="small"
                />
              </div>
            </div>
          </template>
          <div
            v-if="getResponseText(props.record.responseBody)"
            class="mb-2 relative group"
          >
            <div
              class="flex items-center gap-1 text-[10px] text-gray-400 mb-0.5"
            >
              <MessageCircle class="w-3 h-3" />
              {{ t('settingModelLog.cardReply') }}
            </div>
            <Copy
              class="absolute top-0 right-0 w-3.5 h-3.5 text-gray-400 cursor-pointer hover:text-gray-600 opacity-0 group-hover:opacity-100 transition-opacity"
              @click.stop="
                copyText(getResponseText(props.record.responseBody) ?? '')
              "
            />
            <div
              class="text-xs text-gray-600 bg-gray-50 p-2 rounded border border-gray-200 whitespace-pre-wrap max-h-[20vh] overflow-auto"
            >
              {{ getResponseText(props.record.responseBody) }}
            </div>
          </div>
        </div>
      </div>

      <!-- 右侧：原始 JSON -->
      <div class="p-4 flex flex-col gap-4" @click.stop>
        <div class="relative group">
          <div
            class="text-xs font-semibold text-gray-400 mb-2 uppercase tracking-wide flex items-center justify-between"
          >
            <span class="flex items-center gap-1.5"
              ><FileJson class="w-4 h-4" />
              {{ t('settingModelLog.cardRawRequest') }}</span
            >
            <Copy
              class="w-3.5 h-3.5 text-gray-400 cursor-pointer hover:text-gray-600 opacity-0 group-hover:opacity-100 transition-opacity"
              @click.stop="copyText(props.record.requestBody ?? '')"
            />
          </div>
          <JSONViewer
            :value="props.record.requestBody"
            max-height="250px"
            size="small"
          />
        </div>
        <div class="relative group mt-4 border-t border-gray-100 pt-3">
          <div
            class="text-xs font-semibold text-gray-400 mb-2 uppercase tracking-wide flex items-center justify-between"
          >
            <span class="flex items-center gap-1.5"
              ><FileJson class="w-4 h-4" />
              {{ t('settingModelLog.cardRawResponse') }}</span
            >
            <Copy
              class="w-3.5 h-3.5 text-gray-400 cursor-pointer hover:text-gray-600 opacity-0 group-hover:opacity-100 transition-opacity"
              @click.stop="copyText(props.record.responseBody ?? '')"
            />
          </div>
          <JSONViewer
            :value="props.record.responseBody"
            max-height="250px"
            size="small"
          />
        </div>
      </div>
    </div>
  </div>

  <SettingModelLogToolsModal
    v-model:visible="toolsModalVisible"
    :tools="toolsModalData"
  />
</template>
