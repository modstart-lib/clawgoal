<template>
  <a-modal
    width="min(600px, 90vw)"
    :keyboard="false"
    :mask-closable="false"
    :open="open"
    :title="
      isEdit
        ? $t('claw.resource.editMcpTitle')
        : $t('claw.resource.addMcpTitle')
    "
    :ok-text="$t('claw.resource.saveBtn')"
    :cancel-text="$t('claw.resource.cancelBtn')"
    :confirm-loading="loading"
    @ok="handleSubmit"
    @cancel="emit('update:open', false)"
  >
    <a-form layout="vertical" class="mt-4" :model="form">
      <div class="grid grid-cols-2 gap-x-4">
        <a-form-item :label="$t('claw.resource.mcpNameLabel')" required>
          <a-input
            v-model:value="form.name"
            :disabled="isEdit"
            :placeholder="$t('claw.resource.mcpNameFormPlaceholder')"
            :class="isEdit ? 'opacity-60' : ''"
          />
          <div class="text-[11px] text-gray-400 mt-1">
            {{ $t('claw.resource.mcpNameHint') }}
          </div>
        </a-form-item>
        <a-form-item :label="$t('claw.resource.mcpTitleLabel')" required>
          <a-input
            v-model:value="form.title"
            :placeholder="$t('claw.resource.mcpTitlePlaceholder')"
          />
        </a-form-item>
      </div>

      <a-form-item :label="$t('claw.resource.connectionType')" required>
        <a-radio-group
          v-model:value="form.type"
          button-style="solid"
          @change="onTypeChange"
        >
          <a-radio-button value="stdio">
            <span class="flex items-center gap-1"
              ><Terminal class="w-3 h-3" />stdio</span
            >
          </a-radio-button>
          <a-radio-button value="sse">
            <span class="flex items-center gap-1"
              ><Zap class="w-3 h-3" />SSE</span
            >
          </a-radio-button>
          <a-radio-button value="http">
            <span class="flex items-center gap-1"
              ><Globe class="w-3 h-3" />HTTP</span
            >
          </a-radio-button>
        </a-radio-group>
        <div class="text-[11px] text-gray-400 mt-1">
          <template v-if="form.type === 'stdio'">{{
            $t('claw.resource.stdioHint')
          }}</template>
          <template v-else-if="form.type === 'sse'">{{
            $t('claw.resource.sseHint')
          }}</template>
          <template v-else>{{ $t('claw.resource.httpHint') }}</template>
        </div>
      </a-form-item>

      <!-- stdio 配置 -->
      <template v-if="form.type === 'stdio'">
        <a-form-item :label="$t('claw.resource.commandLabel')" required>
          <a-input
            v-model:value="stdioConfig.command"
            :placeholder="$t('claw.resource.commandPlaceholder')"
          />
        </a-form-item>
        <a-form-item :label="$t('claw.resource.argsLabel')">
          <a-input
            v-model:value="stdioArgsRaw"
            :placeholder="$t('claw.resource.argsPlaceholder')"
          />
          <div class="text-[11px] text-gray-400 mt-1">
            {{ $t('claw.resource.argsHint') }}
          </div>
        </a-form-item>
        <a-form-item :label="$t('claw.resource.envLabel')">
          <a-textarea
            v-model:value="stdioEnvRaw"
            :rows="3"
            :placeholder="$t('claw.resource.envPlaceholder')"
          />
        </a-form-item>
      </template>

      <!-- sse / http 配置 -->
      <template v-else>
        <a-form-item :label="$t('claw.resource.urlLabel')" required>
          <a-input
            v-model:value="httpConfig.url"
            :placeholder="
              form.type === 'sse'
                ? 'http://localhost:53001/sse'
                : 'http://localhost:53001/mcp'
            "
          />
        </a-form-item>
        <a-form-item :label="$t('claw.resource.headersLabel')">
          <a-textarea
            v-model:value="httpHeadersRaw"
            :rows="3"
            :placeholder="$t('claw.resource.headerPlaceholder')"
          />
        </a-form-item>
      </template>

      <a-form-item :label="$t('claw.resource.descriptionLabel')">
        <a-input
          v-model:value="form.description"
          :placeholder="$t('claw.resource.descriptionPlaceholder')"
        />
      </a-form-item>

      <a-form-item :label="$t('claw.resource.enableLabel')">
        <a-switch v-model:checked="form.enable" />
      </a-form-item>
    </a-form>
  </a-modal>
</template>

<script setup lang="ts">
import { message } from 'ant-design-vue'
import Globe from '~icons/lucide/globe'
import Terminal from '~icons/lucide/terminal'
import Zap from '~icons/lucide/zap'
import { onMounted, onUnmounted, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import type { HttpMcpConfig, McpRow, StdioMcpConfig } from '@/claw/api/mcp'
import { addMcp, updateMcp } from '@/claw/api/mcp'
import { testActionSet, testActionUnset } from '@/utils/test'

const { t } = useI18n()

const props = defineProps<{
  open: boolean
  editRow?: McpRow | null
  cloneRow?: McpRow | null
}>()
const emit = defineEmits<{
  (e: 'update:open', v: boolean): void
  (e: 'saved'): void
}>()

const isEdit = ref(false)
const loading = ref(false)

const form = reactive({
  name: '',
  title: '',
  type: 'stdio' as 'stdio' | 'sse' | 'http',
  description: '',
  enable: true,
})

const stdioConfig = reactive<StdioMcpConfig>({
  command: '',
  args: [],
  env: {},
})
const stdioArgsRaw = ref('')
const stdioEnvRaw = ref('')

const httpConfig = reactive<HttpMcpConfig>({ url: '', headers: {} })
const httpHeadersRaw = ref('')

function onTypeChange() {
  // type 切换时清空临时输入
}

function resetForm() {
  form.name = ''
  form.title = ''
  form.type = 'stdio'
  form.description = ''
  form.enable = true
  stdioConfig.command = ''
  stdioArgsRaw.value = ''
  stdioEnvRaw.value = ''
  httpConfig.url = ''
  httpHeadersRaw.value = ''
}

function loadFromRow(row: McpRow) {
  form.name = row.name
  form.title = row.title
  form.type = row.type as 'stdio' | 'sse' | 'http'
  form.description = row.description ?? ''
  form.enable = row.enable === 1
  const cfg = (row.config ?? {}) as any
  if (row.type === 'stdio') {
    stdioConfig.command = cfg.command ?? ''
    stdioArgsRaw.value = (cfg.args ?? []).join(' ')
    stdioEnvRaw.value = Object.entries(cfg.env ?? {})
      .map(([k, v]) => `${k}=${v}`)
      .join('\n')
  } else {
    httpConfig.url = cfg.url ?? ''
    httpHeadersRaw.value = Object.entries(cfg.headers ?? {})
      .map(([k, v]) => `${k}: ${v}`)
      .join('\n')
  }
}

watch(
  () => props.open,
  (v) => {
    if (v) {
      if (props.editRow) {
        isEdit.value = true
        loadFromRow(props.editRow)
      } else if (props.cloneRow) {
        isEdit.value = false
        loadFromRow(props.cloneRow)
        form.name = '' // 克隆时清空名称，需要用户重新填写
      } else {
        isEdit.value = false
        resetForm()
      }
    }
  }
)

function buildConfig() {
  if (form.type === 'stdio') {
    const args = stdioArgsRaw.value.trim()
      ? stdioArgsRaw.value.trim().split(/\s+/)
      : []
    const env: Record<string, string> = {}
    stdioEnvRaw.value.split('\n').forEach((line) => {
      const idx = line.indexOf('=')
      if (idx > 0) {
        env[line.slice(0, idx).trim()] = line.slice(idx + 1).trim()
      }
    })
    return {
      command: stdioConfig.command,
      args,
      ...(Object.keys(env).length ? { env } : {}),
    }
  } else {
    const headers: Record<string, string> = {}
    httpHeadersRaw.value.split('\n').forEach((line) => {
      const idx = line.indexOf(':')
      if (idx > 0) {
        headers[line.slice(0, idx).trim()] = line.slice(idx + 1).trim()
      }
    })
    return {
      url: httpConfig.url,
      ...(Object.keys(headers).length ? { headers } : {}),
    }
  }
}

async function handleSubmit() {
  if (!form.name.trim() || !form.title.trim()) {
    message.warning(t('claw.resource.nameAndTitleEmptyError'))
    return
  }
  if (form.type === 'stdio' && !stdioConfig.command.trim()) {
    message.warning(t('claw.resource.commandEmptyError'))
    return
  }
  if ((form.type === 'sse' || form.type === 'http') && !httpConfig.url.trim()) {
    message.warning(t('claw.resource.urlEmptyError'))
    return
  }

  loading.value = true
  try {
    const config = buildConfig()
    if (isEdit.value && props.editRow) {
      await updateMcp({
        id: props.editRow.id,
        title: form.title,
        type: form.type,
        enable: form.enable,
        config,
        description: form.description,
      })
      message.success(t('claw.resource.mcpUpdated'))
    } else {
      await addMcp({
        name: form.name,
        title: form.title,
        type: form.type,
        enable: form.enable,
        config,
        description: form.description,
      })
      message.success(t('claw.resource.mcpAdded'))
    }
    emit('update:open', false)
    emit('saved')
  } catch (e: any) {
    message.error(
      e?.response?.data?.message ?? t('claw.resource.mcpOperationFailed')
    )
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  testActionSet('modal.fillTitle', (title: string) => {
    form.title = title
  })
  testActionSet('modal.submit', () => handleSubmit())
  testActionSet('modal.close', () => emit('update:open', false))
})

onUnmounted(() => {
  testActionUnset('modal.fillTitle')
  testActionUnset('modal.submit')
  testActionUnset('modal.close')
})
</script>
