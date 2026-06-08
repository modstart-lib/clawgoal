<script setup lang="ts">
import { computed, ref, watch, nextTick } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  Copy,
  Sparkles,
  Pencil,
  Check,
  MousePointerClick,
} from 'lucide-vue-next'
import { message } from 'ant-design-vue'
import { setNodePropertiesById } from '../core/global'
import { dispatchAsksAction } from '@/composables/asksActionBus'
import { FunctionCallNode, builtinNodes, userNodes } from '../base'
import { nodeIconMap, DefaultNodeIcon } from '../core/nodeIconMap'
import VariableInput from './VariableInput.vue'
import VariableTextareaInput from './VariableTextareaInput.vue'
import FlowFilePreviewButton from './FlowFilePreviewButton.vue'
import { chatWithModel } from '@/api/model'
import { copyText, safeJsonParse } from '@/utils/utils'

const { t } = useI18n()

const PREVIEW_EXTS = new Set([
  'mp4',
  'webm',
  'mov',
  'avi',
  'jpg',
  'jpeg',
  'png',
  'gif',
  'webp',
  'bmp',
  'mp3',
  'wav',
  'ogg',
  'aac',
  'flac',
  'm4a',
])
function isPreviewablePath(val: unknown): val is string {
  if (typeof val !== 'string') return false
  if (!val.startsWith('/')) return false
  const ext = val.split('.').pop()?.toLowerCase() ?? ''
  return PREVIEW_EXTS.has(ext)
}

const props = defineProps<{
  open?: boolean
  selectedNodeId: string | null
  selectedNodeProperties: any
  readonly?: boolean
}>()

const emit = defineEmits<{ close: [] }>()

const allNodeDefs = computed(() => [
  ...builtinNodes,
  ...userNodes,
  FunctionCallNode,
])

const nodeIcon = computed(
  () =>
    nodeIconMap[props.selectedNodeProperties?.type] ??
    nodeIconMap[props.selectedNodeProperties?.data?.functionCallName] ??
    DefaultNodeIcon
)

const nodeDef = computed(() =>
  allNodeDefs.value.find((n) => n.type === props.selectedNodeProperties?.type)
)

const configComponent = computed(() => nodeDef.value?.configComponent)

const editingTitle = ref(false)
const titleInputRef = ref<any>(null)
const localProperties = ref<any>(null)
watch(
  () => props.selectedNodeProperties,
  (v) => {
    localProperties.value = v ? { ...v } : null
    editingTitle.value = false
  },
  { immediate: true }
)
const editingTitleValue = ref('')

function startEditTitle() {
  editingTitleValue.value = localProperties.value?.title || ''
  editingTitle.value = true
  nextTick(() => {
    titleInputRef.value?.focus()
  })
}

function confirmEditTitle() {
  if (props.selectedNodeId) {
    setNodePropertiesById(props.selectedNodeId, {
      title: editingTitleValue.value,
    })
  }
  editingTitle.value = false
}

function onUpdateProperties(updates: any) {
  if (!props.selectedNodeId) return
  setNodePropertiesById(props.selectedNodeId, updates)
}

function handleAsksAction() {
  dispatchAsksAction()
}

function copyRef(fieldName: string) {
  const title = props.selectedNodeProperties?.title
  copyText(`\${${title}.${fieldName}}`, false)
}

const smartOpen = ref(false)
const smartText = ref('')
const smartLoading = ref(false)

async function handleSmartConfig() {
  if (!smartText.value.trim()) return
  smartLoading.value = true
  try {
    const def = nodeDef.value
    const nodeType = def?.title || props.selectedNodeProperties?.type || ''
    const propsJson = JSON.stringify(props.selectedNodeProperties, null, 2)
    const systemPrompt = t('workflowEditor.smartConfigSystemPrompt', {
      nodeType,
      props: propsJson,
    })
    const res = await chatWithModel({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: smartText.value.trim() },
      ],
    })
    const content = res.message.content.trim()
    const jsonStr = content
      .replace(/^```(?:json)?\n?/, '')
      .replace(/\n?```$/, '')
    const updates = safeJsonParse(jsonStr, {})
    onUpdateProperties(updates)
    smartOpen.value = false
    smartText.value = ''
    message.success(t('workflowEditor.smartConfigApplied'))
  } catch (e: any) {
    message.error(
      t('workflowEditor.parseFailed') +
        (e?.message || t('workflowEditor.unknownError'))
    )
  } finally {
    smartLoading.value = false
  }
}
</script>

<template>
  <a-modal
    :open="open && !!(selectedNodeId && localProperties)"
    :title="null"
    :footer="null"
    :closable="true"
    width="min(700px, 95vw)"
    :style="{ top: '30px' }"
    :styles="{ body: { padding: 0 } }"
    @cancel="emit('close')"
  >
    <!-- Header -->
    <div v-if="localProperties" class="px-3 py-2 border-b border-gray-100">
      <div class="flex items-center gap-2">
        <component
          :is="nodeIcon"
          class="w-4 h-4 shrink-0 text-gray-600"
          aria-hidden="true"
        />
        <!-- 标题展示/编辑 -->
        <template v-if="!props.readonly && editingTitle">
          <a-input
            ref="titleInputRef"
            v-model:value="editingTitleValue"
            class="flex-1"
            size="small"
            @press-enter="confirmEditTitle"
            @keydown.esc="editingTitle = false"
            @blur="confirmEditTitle"
          />
          <a-button class="inline-flex items-center" @click="confirmEditTitle">
            <Check class="w-4 h-4" aria-hidden="true" />
          </a-button>
        </template>
        <template v-else>
          <span class="flex-1 text-sm font-medium truncate">{{
            localProperties.title
          }}</span>
          <a-button
            v-if="!props.readonly"
            class="inline-flex items-center"
            @click="startEditTitle"
          >
            <Pencil class="w-4 h-4" aria-hidden="true" />
          </a-button>
        </template>
        <a-button
          v-if="!props.readonly"
          class="inline-flex items-center !text-purple-600 !border-purple-200 hover:!bg-purple-50"
          @click="smartOpen = true"
        >
          <div class="inline-flex items-center gap-1">
            <Sparkles class="w-4 h-4" aria-hidden="true" />{{
              t('workflowEditor.smartConfig')
            }}
          </div>
        </a-button>
      </div>
      <!-- 原始类型说明 -->
      <div v-if="nodeDef?.title" class="text-xs text-gray-400 mt-1 ml-6">
        {{ nodeDef.title }}
      </div>
      <!-- 暂停时处理选择按钮 -->
      <div
        v-if="
          localProperties.status === 'pause' && localProperties.type === 'Asks'
        "
        class="mt-2"
      >
        <a-button
          type="primary"
          class="inline-flex items-center gap-1"
          @click="handleAsksAction"
        >
          <div class="inline-flex items-center gap-1">
            <MousePointerClick class="w-4 h-4" aria-hidden="true" />{{
              t('workflowEditor.handleSelect')
            }}
          </div>
        </a-button>
      </div>
    </div>
    <div v-if="localProperties" class="overflow-y-auto max-h-[70vh]">
      <!-- 运行数据（只读模式下） -->
      <template v-if="props.readonly">
        <div
          v-if="localProperties.status && localProperties.status !== 'idle'"
          class="p-3 border-b border-gray-100"
        >
          <div class="text-xs font-medium text-gray-400 mb-2">
            {{ t('workflowEditor.runStatus') }}
          </div>
          <div class="flex items-center gap-2">
            <span
              :class="{
                'text-blue-500': localProperties.status === 'running',
                'text-green-600':
                  localProperties.status === 'success' ||
                  localProperties.status === 'success_ignore',
                'text-red-500': localProperties.status === 'error',
                'text-gray-400': localProperties.status === 'idle',
              }"
              class="text-xs font-medium"
            >
              {{
                localProperties.status === 'running'
                  ? t('workflowEditor.runStatusRunning')
                  : localProperties.status === 'success'
                    ? t('workflowEditor.runStatusSuccess')
                    : localProperties.status === 'success_ignore'
                      ? t('workflowEditor.runStatusSkip')
                      : localProperties.status === 'error'
                        ? t('workflowEditor.runStatusFail')
                        : localProperties.status
              }}
            </span>
            <span
              v-if="localProperties.statusMsg"
              class="text-xs text-red-400"
              >{{ localProperties.statusMsg }}</span
            >
          </div>
        </div>
        <div
          v-if="
            localProperties.runInputs &&
            Object.keys(localProperties.runInputs).length
          "
          class="p-3 border-b border-gray-100"
        >
          <div class="text-xs font-medium text-gray-400 mb-2">
            {{ t('workflowEditor.inputData') }}
          </div>
          <div
            v-for="(val, key) in localProperties.runInputs"
            :key="key"
            class="mb-2"
          >
            <div class="text-xs text-gray-500 mb-1">{{ key }}</div>
            <div class="flex items-center gap-1">
              <div
                class="flex-1 text-xs bg-gray-50 rounded p-2 break-all whitespace-pre-wrap max-h-32 overflow-y-auto"
              >
                {{
                  typeof val === 'object'
                    ? JSON.stringify(val, null, 2)
                    : String(val ?? '')
                }}
              </div>
              <FlowFilePreviewButton
                v-if="isPreviewablePath(val)"
                :file-path="String(val)"
              />
            </div>
          </div>
        </div>
        <div
          v-if="
            localProperties.runOutputs &&
            Object.keys(localProperties.runOutputs).length
          "
          class="p-3 border-b border-gray-100"
        >
          <div class="text-xs font-medium text-gray-400 mb-2">
            {{ t('workflowEditor.outputData') }}
          </div>
          <div
            v-for="(val, key) in localProperties.runOutputs"
            :key="key"
            class="mb-2"
          >
            <div class="text-xs text-gray-500 mb-1">{{ key }}</div>
            <div class="flex items-center gap-1">
              <div
                class="flex-1 text-xs bg-gray-50 rounded p-2 break-all whitespace-pre-wrap max-h-32 overflow-y-auto"
              >
                {{
                  typeof val === 'object'
                    ? JSON.stringify(val, null, 2)
                    : String(val ?? '')
                }}
              </div>
              <FlowFilePreviewButton
                v-if="isPreviewablePath(val)"
                :file-path="String(val)"
              />
            </div>
          </div>
        </div>
        <div
          v-if="
            (!localProperties.runInputs ||
              !Object.keys(localProperties.runInputs).length) &&
            (!localProperties.runOutputs ||
              !Object.keys(localProperties.runOutputs).length) &&
            (!localProperties.status || localProperties.status === 'idle')
          "
          class="p-4 text-xs text-gray-400 text-center"
        >
          {{ t('workflowEditor.noRunData') }}
        </div>
      </template>
      <!-- 编辑模式 -->
      <template v-else>
        <!-- Input fields（仅在无 configComponent 时显示，避免重复） -->
        <div
          v-if="localProperties.inputFields?.length"
          class="p-3 border-b border-gray-100"
        >
          <div class="text-xs font-medium text-gray-400 mb-2">
            {{ t('workflowEditor.inputFields') }}
          </div>
          <div
            v-for="field in localProperties.inputFields"
            :key="field.name"
            class="mb-2"
          >
            <div class="text-xs text-gray-500 mb-1">{{ field.name }}</div>
            <VariableTextareaInput
              v-if="field.type === 'textarea'"
              :model-value="field.value"
              :placeholder="field.placeholder"
              :node-id="selectedNodeId || undefined"
              @change="
                (val: string) => {
                  const fields = JSON.parse(
                    JSON.stringify(localProperties.inputFields)
                  )
                  const f = fields.find((f: any) => f.name === field.name)
                  if (f) f.value = val
                  onUpdateProperties({ inputFields: fields })
                }
              "
            />
            <div v-else class="flex items-center gap-1">
              <VariableInput
                :model-value="field.value"
                :placeholder="field.placeholder"
                :node-id="selectedNodeId || undefined"
                class="flex-1"
                @change="
                  (val: string) => {
                    const fields = JSON.parse(
                      JSON.stringify(localProperties.inputFields)
                    )
                    const f = fields.find((f: any) => f.name === field.name)
                    if (f) f.value = val
                    onUpdateProperties({ inputFields: fields })
                  }
                "
              />
              <FlowFilePreviewButton
                v-if="isPreviewablePath(field.value)"
                :file-path="field.value"
              />
            </div>
          </div>
        </div>
        <!-- Config component -->
        <div v-if="configComponent" class="border-b border-gray-100">
          <component
            :is="configComponent"
            :node="{ id: selectedNodeId }"
            :properties="localProperties"
            @update:properties="onUpdateProperties"
          />
        </div>
        <!-- Output fields -->
        <div v-if="localProperties.outputFields?.length" class="p-3">
          <div class="text-xs font-medium text-gray-400 mb-2">
            {{ t('workflowEditor.outputVars') }}
          </div>
          <div
            v-for="field in localProperties.outputFields"
            :key="field.name"
            class="flex items-center gap-1 mb-1 text-xs text-gray-600 cursor-pointer hover:text-blue-500"
            @click="copyRef(field.name)"
          >
            <Copy class="w-3 h-3" aria-hidden="true" />
            <code>${ {{ localProperties.title }}.{{ field.name }} }</code>
          </div>
        </div>
      </template>
    </div>
  </a-modal>

  <!-- 智能配置弹窗 -->
  <a-modal
    v-model:open="smartOpen"
    :title="t('workflowEditor.smartConfig')"
    :width="'min(480px, 90vw)'"
    :confirm-loading="smartLoading"
    :ok-text="t('workflowEditor.applyConfig')"
    :cancel-text="t('common.cancel')"
    @ok="handleSmartConfig"
  >
    <div class="py-2">
      <div class="text-sm text-gray-500 mb-2">
        {{ t('workflowEditor.smartConfigDesc') }}
      </div>
      <a-textarea
        v-model:value="smartText"
        :rows="5"
        :placeholder="t('workflowEditor.smartConfigPlaceholder')"
        @keydown.ctrl.enter="handleSmartConfig"
      />
    </div>
  </a-modal>
</template>
