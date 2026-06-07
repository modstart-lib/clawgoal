<script setup lang="ts">
import { updateAgentBasic } from '@/claw/api/agent'
import AgentAvatarSelector from '@/claw/components/AgentAvatarSelector.vue'
import type { CharacterConfig } from 'cube-character'
import type { Agent } from '@/types'
import { message } from 'ant-design-vue'
import { onMounted, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { testActionSet, testActionUnset } from '@/utils/test'

const { t } = useI18n()

const props = defineProps<{
  open: boolean
  agent: Agent
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  updated: [agent: Partial<Agent>]
}>()

const submitting = ref(false)
const form = ref({ title: '', description: '' })
const avatarUrl = ref<string | null>(null)
const avatarConfig = ref<CharacterConfig | null>(null)

watch(
  () => props.open,
  (val) => {
    if (val) {
      form.value = {
        title: props.agent.title,
        description: props.agent.description ?? '',
      }
      avatarUrl.value = props.agent.avatar ?? null
      avatarConfig.value =
        (props.agent.avatarConfig as CharacterConfig | null | undefined) ?? null
    }
  }
)

onMounted(() => {
  testActionSet('modal.fillTitle', (val: string) => {
    form.value.title = val
  })
  testActionSet('modal.submit', () => handleOk())
  testActionSet('modal.close', () => emit('update:open', false))
})
onUnmounted(() => {
  testActionUnset('modal.fillTitle')
  testActionUnset('modal.submit')
  testActionUnset('modal.close')
})

const handleOk = async () => {
  if (!form.value.title.trim()) {
    message.warning(t('claw.agent.titleRequired'))
    return
  }
  submitting.value = true
  try {
    await updateAgentBasic(props.agent.id, {
      title: form.value.title,
      description: form.value.description || undefined,
      avatar: avatarUrl.value,
      avatarConfig: avatarConfig.value,
    })
    message.success(t('claw.agent.editSuccess'))
    emit('updated', {
      title: form.value.title,
      description: form.value.description || null,
      avatar: avatarUrl.value,
      avatarConfig: avatarConfig.value,
    })
    emit('update:open', false)
  } catch (e: any) {
    message.error(e.message || t('claw.agent.editFailed'))
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <a-modal
    width="min(600px, 90vw)"
    :keyboard="false"
    :mask-closable="false"
    :open="open"
    :title="$t('claw.agent.editTitle')"
    :confirm-loading="submitting"
    :ok-text="$t('common.save')"
    :cancel-text="$t('common.cancel')"
    @ok="handleOk"
    @cancel="emit('update:open', false)"
  >
    <a-form layout="vertical" class="mt-4">
      <a-form-item :label="$t('claw.agent.avatarLabel')">
        <AgentAvatarSelector
          v-model="avatarUrl"
          v-model:avatar-config="avatarConfig"
        />
      </a-form-item>

      <a-form-item :label="$t('claw.agent.titleLabel')" required>
        <a-input
          v-model:value="form.title"
          :placeholder="$t('claw.agent.titlePlaceholder')"
          :maxlength="50"
        />
      </a-form-item>

      <a-form-item :label="$t('claw.agent.descriptionLabel')">
        <a-textarea
          v-model:value="form.description"
          :placeholder="$t('claw.agent.descriptionEditPlaceholder')"
          :maxlength="200"
          :rows="3"
        />
      </a-form-item>
    </a-form>
  </a-modal>
</template>
