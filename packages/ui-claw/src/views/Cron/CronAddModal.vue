<script setup lang="ts">
import {
  addCronTask,
  updateCronTask,
  type CronConfig,
  type CronTask,
} from '@/claw/api/cron'
import CronInput from '@/components/CronInput.vue'
import CronViewer from '@/components/CronViewer.vue'
import AgentSelector from '@/claw/views/Agent/AgentSelector.vue'
import { message } from 'ant-design-vue'
import Bot from '~icons/lucide/bot'
import Terminal from '~icons/lucide/terminal'
import { computed, onMounted, onUnmounted, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { testActionSet, testActionUnset } from '@/utils/test'
import { getAgents } from '@/claw/api/agent'

const { t } = useI18n()

const props = defineProps<{
  open: boolean
  task?: CronTask | null
  /** 复制模式：预填内容但作为新建 */
  copyFrom?: CronTask | null
  /** 新建任务时预填的 agentId（如从 AgentDetail 打开时传入） */
  initialAgentId?: string
  /** 锁定到 Agent 模式：隐藏执行类型选择，且智能体只读 */
  lockToAgent?: boolean
}>()

const emit = defineEmits<{
  'update:open': [val: boolean]
  saved: [task: CronTask]
}>()

const formRef = ref()
const saving = ref(false)

const defaultForm = () => ({
  name: '',
  cron: '',
  agentId: undefined as string | undefined,
  configType: 'agent' as CronConfig['type'],
  configShell: '',
  configShellWorkdir: '',
  configAgent: '',
  description: '',
  enabled: true,
  successNotify: false,
})

const formData = reactive(defaultForm())

const formRules = computed(() => ({
  name: [
    {
      required: true,
      message: t('claw.cron.taskNameRequired'),
      trigger: 'blur',
    },
  ],
  cron: [
    { required: true, message: t('claw.cron.cronRequired'), trigger: 'change' },
  ],
  agentId: [
    {
      required: true,
      message: t('claw.cron.agentRequired'),
      trigger: 'change',
    },
  ],
  configShell:
    formData.configType === 'shell'
      ? [
          {
            required: true,
            message: t('claw.cron.configShellRequired'),
            trigger: 'blur',
          },
        ]
      : [],
  configAgent:
    formData.configType === 'agent'
      ? [
          {
            required: true,
            message: t('claw.cron.configAgentRequired'),
            trigger: 'blur',
          },
        ]
      : [],
}))

watch(
  () => props.open,
  (val) => {
    if (val) {
      if (props.task) {
        Object.assign(formData, {
          name: props.task.name,
          cron: props.task.cron,
          agentId: props.task.agentId || undefined,
          configType: props.task.config?.type ?? 'agent',
          configShell: props.task.config?.shell ?? '',
          configShellWorkdir: props.task.config?.workdir ?? '',
          configAgent: props.task.config?.agent ?? '',
          description: props.task.description || '',
          enabled: props.task.status !== 'disabled',
          successNotify: props.task.successNotify ?? false,
        })
      } else if (props.copyFrom) {
        Object.assign(formData, {
          name: props.copyFrom.name,
          cron: props.copyFrom.cron,
          agentId: props.copyFrom.agentId || undefined,
          configType: props.copyFrom.config?.type ?? 'agent',
          configShell: props.copyFrom.config?.shell ?? '',
          configShellWorkdir: props.copyFrom.config?.workdir ?? '',
          configAgent: props.copyFrom.config?.agent ?? '',
          description: props.copyFrom.description || '',
          enabled: props.copyFrom.status !== 'disabled',
          successNotify: props.copyFrom.successNotify ?? false,
        })
      } else {
        Object.assign(formData, {
          ...defaultForm(),
          agentId: props.initialAgentId,
          configType: props.lockToAgent ? 'agent' : 'agent',
        })
      }
    }
  }
)

const handleOk = async () => {
  try {
    await formRef.value?.validate()
  } catch {
    return
  }
  saving.value = true
  try {
    const config: CronConfig =
      formData.configType === 'shell'
        ? {
            type: 'shell',
            shell: formData.configShell,
            workdir: formData.configShellWorkdir || undefined,
          }
        : { type: 'agent', agent: formData.configAgent }

    const payload = {
      name: formData.name,
      cron: formData.cron,
      config,
      description: formData.description,
      agentId: formData.agentId,
      enable: formData.enabled,
      successNotify: formData.successNotify,
    }
    let saved: CronTask
    if (props.task) {
      saved = await updateCronTask(props.task.id, payload)
      message.success(t('claw.cron.updateSuccess'))
    } else {
      saved = await addCronTask(payload)
      message.success(t('claw.cron.addSuccess'))
    }
    emit('saved', saved)
    emit('update:open', false)
  } catch (e: any) {
    message.error(e.message || t('claw.cron.operationFailed'))
  } finally {
    saving.value = false
  }
}

onMounted(() => {
  testActionSet('cron.add.fill', async () => {
    formData.name = `测试任务_${Date.now()}`
    formData.cron = '0 9 * * *'
    formData.configType = 'shell'
    formData.configShell = 'echo "test cron task"'
    formData.enabled = true
    // 加载 agent 列表，取第一个
    const agents = await getAgents().catch(() => [])
    if (agents.length > 0) {
      formData.agentId = agents[0].id
    }
  })
  testActionSet('cron.add.submit', () => handleOk())
})
onUnmounted(() => {
  testActionUnset('cron.add.fill')
  testActionUnset('cron.add.submit')
})
</script>

<template>
  <a-modal
    :keyboard="false"
    :mask-closable="false"
    :open="open"
    :title="task ? $t('claw.cron.editTitle') : $t('claw.cron.addTitle')"
    width="min(600px, 90vw)"
    :ok-text="$t('claw.cron.saveBtn')"
    :cancel-text="$t('common.cancel')"
    :confirm-loading="saving"
    @ok="handleOk"
    @cancel="emit('update:open', false)"
  >
    <a-form
      ref="formRef"
      :model="formData"
      :rules="formRules"
      layout="vertical"
      class="mt-4"
    >
      <a-form-item :label="$t('claw.cron.taskName')" name="name">
        <a-input
          v-model:value="formData.name"
          :placeholder="$t('claw.cron.taskNamePlaceholder')"
          :maxlength="50"
          show-count
        />
      </a-form-item>
      <a-form-item :label="$t('claw.cron.cronLabel')" name="cron">
        <CronInput v-model:value="formData.cron" />
        <div v-if="formData.cron" class="mt-1.5">
          <CronViewer :value="formData.cron" />
        </div>
      </a-form-item>

      <!-- 智能体选择（所有模式都必选） -->
      <a-form-item :label="$t('claw.cron.agentLabel')" name="agentId">
        <AgentSelector
          v-model:value="formData.agentId"
          :disabled="lockToAgent"
        />
      </a-form-item>

      <!-- 执行类型（lockToAgent 时隐藏） -->
      <a-form-item
        v-if="!lockToAgent"
        :label="$t('claw.cron.configTypeLabel')"
        name="configType"
      >
        <a-radio-group v-model:value="formData.configType" button-style="solid">
          <a-radio-button value="agent">
            <div class="inline-flex items-center gap-1">
              <Bot class="w-3.5 h-3.5" />
              {{ $t('claw.cron.configTypeAgent') }}
            </div>
          </a-radio-button>
          <a-radio-button value="shell">
            <div class="inline-flex items-center gap-1">
              <Terminal class="w-3.5 h-3.5" />
              {{ $t('claw.cron.configTypeShell') }}
            </div>
          </a-radio-button>
        </a-radio-group>
      </a-form-item>

      <!-- Agent 模式：指令 -->
      <template v-if="formData.configType === 'agent'">
        <a-form-item
          :label="$t('claw.cron.configAgentLabel')"
          name="configAgent"
        >
          <a-textarea
            v-model:value="formData.configAgent"
            :rows="4"
            :placeholder="$t('claw.cron.configAgentPlaceholder')"
          />
        </a-form-item>
      </template>

      <!-- Shell 模式：命令输入 + 工作目录 -->
      <template v-else>
        <a-form-item
          :label="$t('claw.cron.configShellLabel')"
          name="configShell"
        >
          <a-textarea
            v-model:value="formData.configShell"
            :rows="4"
            :placeholder="$t('claw.cron.configShellPlaceholder')"
            class="font-mono text-sm"
          />
        </a-form-item>
        <a-form-item
          :label="$t('claw.cron.configShellWorkdirLabel')"
          name="configShellWorkdir"
        >
          <a-input
            v-model:value="formData.configShellWorkdir"
            :placeholder="$t('claw.cron.configShellWorkdirPlaceholder')"
            class="font-mono text-sm"
          />
        </a-form-item>
      </template>

      <a-form-item :label="$t('claw.cron.descriptionLabel')" name="description">
        <a-textarea
          v-model:value="formData.description"
          :rows="2"
          :placeholder="$t('claw.cron.descriptionPlaceholder')"
          :maxlength="200"
          show-count
        />
      </a-form-item>
      <a-form-item :label="$t('claw.cron.enabledLabel')" name="enabled">
        <a-switch v-model:checked="formData.enabled" />
      </a-form-item>
      <a-form-item
        :label="$t('claw.cron.successNotifyLabel')"
        name="successNotify"
      >
        <a-switch v-model:checked="formData.successNotify" />
        <div class="text-xs text-gray-400 mt-1">
          {{ $t('claw.cron.successNotifyTip') }}
        </div>
      </a-form-item>
    </a-form>
  </a-modal>
</template>
