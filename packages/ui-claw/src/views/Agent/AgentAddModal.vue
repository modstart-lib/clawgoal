<script setup lang="ts">
import { addAgent, getRoleDetail, getRoles } from '@/claw/api/agent'
import AgentAvatarSelector from '@/claw/components/AgentAvatarSelector.vue'
import ProjectSelector from '@/claw/components/ProjectSelector.vue'
import type { Agent, RoleParamDef } from '@/types'
import type { CharacterConfig } from 'cube-character'
import { message } from 'ant-design-vue'
import { onMounted, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import AgentParamForm from './AgentParamForm.vue'
import AgentRoleSelector from './AgentRoleSelector.vue'
import { testActionSet, testActionUnset } from '@/utils/test'
import { addProject, listProjects } from '@/claw/api/project'

const { t } = useI18n()

const props = defineProps<{
  open: boolean
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  created: [agent: Agent]
}>()

const submitting = ref(false)
const form = ref({ name: '', roleName: '' })
const avatarUrl = ref<string | null>(null)
const avatarConfig = ref<CharacterConfig | null>(null)
const paramDefs = ref<RoleParamDef[]>([])
const paramValues = ref<Record<string, string>>({})
const selectedProjectId = ref<number | undefined>(undefined)

watch(
  () => props.open,
  (val) => {
    if (val) {
      form.value = { name: '', roleName: '' }
      avatarUrl.value = null
      avatarConfig.value = null
      paramDefs.value = []
      paramValues.value = {}
      selectedProjectId.value = undefined
    }
  }
)

async function handleRoleChange(roleName: string) {
  paramDefs.value = []
  paramValues.value = {}
  if (!roleName) return
  try {
    const detail = await getRoleDetail(roleName)
    paramDefs.value = detail.param ?? []
    const initial: Record<string, string> = {}
    for (const def of paramDefs.value) {
      initial[def.name] = def.defaultValue ?? ''
    }
    paramValues.value = initial
  } catch {
    // 忽略，不影响主流程
  }
}

const handleOk = async () => {
  if (!form.value.name.trim()) {
    message.warning(t('claw.agent.agentNameRequired'))
    return
  }
  if (!form.value.roleName) {
    message.warning(t('claw.agent.roleRequired'))
    return
  }
  if (!selectedProjectId.value) {
    message.warning(t('claw.agent.projectSelectRequired'))
    return
  }
  // 校验 required param
  for (const def of paramDefs.value) {
    if (def.required && !paramValues.value[def.name]?.trim()) {
      message.warning(t('claw.agent.paramRequired', { title: def.title }))
      return
    }
  }
  submitting.value = true
  try {
    const agent = await addAgent({
      name: form.value.name,
      roleName: form.value.roleName,
      avatar: avatarUrl.value || undefined,
      avatarConfig: avatarConfig.value ?? undefined,
      param: paramDefs.value.length > 0 ? paramValues.value : undefined,
      projectId: selectedProjectId.value,
    })
    message.success(t('claw.agent.addSuccess'))
    emit('created', agent)
    emit('update:open', false)
  } catch (e: any) {
    message.error(e.message || t('claw.agent.addFailed'))
  } finally {
    submitting.value = false
  }
}

onMounted(() => {
  testActionSet('agent.add.fill', async () => {
    form.value.name = `测试Agent_${Date.now()}`
    // 加载角色列表，取第一个
    const roles = await getRoles().catch(() => [])
    if (roles.length > 0) {
      form.value.roleName = roles[0].name
      await handleRoleChange(roles[0].name)
    }
    // 为所有 required param 填充测试默认值
    for (const def of paramDefs.value) {
      if (def.required && !paramValues.value[def.name]?.trim()) {
        paramValues.value[def.name] =
          def.defaultValue?.trim() || './_temp/test-workspace'
      }
    }
    // 加载项目列表，取第一个
    let projects = await listProjects().catch(() => [])
    if (projects.length === 0) {
      const project = await addProject({
        title: `测试项目_${Date.now()}`,
        description: 'UI test project',
        status: 'active',
      }).catch(() => null)
      projects = project ? [project] : []
    }
    if (projects.length > 0) {
      selectedProjectId.value = projects[0].id
    }
  })
  testActionSet('agent.add.submit', () => handleOk())
})
onUnmounted(() => {
  testActionUnset('agent.add.fill')
  testActionUnset('agent.add.submit')
})
</script>

<template>
  <a-modal
    width="min(600px, 90vw)"
    :keyboard="false"
    :mask-closable="false"
    :open="open"
    :title="$t('claw.agent.addTitle')"
    :confirm-loading="submitting"
    :ok-text="$t('claw.agent.addBtn')"
    :cancel-text="$t('common.cancel')"
    @ok="handleOk"
    @cancel="emit('update:open', false)"
  >
    <a-form layout="vertical" class="mt-4">
      <!-- 头像选择 -->
      <a-form-item :label="$t('claw.agent.avatar')">
        <AgentAvatarSelector
          v-model="avatarUrl"
          v-model:avatar-config="avatarConfig"
        />
      </a-form-item>

      <a-form-item :label="$t('claw.agent.agentName')" required>
        <a-input
          v-model:value="form.name"
          :placeholder="$t('claw.agent.agentNamePlaceholder')"
          :maxlength="50"
        />
      </a-form-item>
      <a-form-item :label="$t('claw.agent.roleTemplate')" required>
        <AgentRoleSelector
          v-model:value="form.roleName"
          :auto-select-first="true"
          @change="handleRoleChange"
        />
      </a-form-item>

      <!-- 所属项目 -->
      <a-form-item :label="t('claw.agent.projectTitle')" required>
        <ProjectSelector
          v-model="selectedProjectId"
          :placeholder="t('claw.agent.projectPlaceholder')"
        />
      </a-form-item>

      <!-- 角色参数（required 字段必填，其余可选） -->
      <template v-if="paramDefs.length > 0">
        <a-divider class="my-3" />
        <p class="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
          {{ t('claw.agent.roleParamTitle') }}
        </p>
        <AgentParamForm v-model="paramValues" :defs="paramDefs" />
      </template>
    </a-form>
  </a-modal>
</template>
