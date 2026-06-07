<script setup lang="ts">
import { getAgentMemory, setAgentMemory } from '@/claw/api/memory'
import MarkdownEditor from '@/components/MarkdownEditor.vue'
import MarkdownViewer from '@/components/MarkdownViewer.vue'
import { message } from 'ant-design-vue'
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { Pencil, Save, BrainCircuit } from 'lucide-vue-next'
import { testActionSet, testActionUnset } from '@/utils/test'

const { t } = useI18n()

const props = defineProps<{ agentId: number }>()

const content = ref('')
const originalContent = ref('')
const loading = ref(false)
const saving = ref(false)
const editing = ref(false)

const isDirty = computed(() => content.value !== originalContent.value)

onMounted(async () => {
  loading.value = true
  try {
    const text = await getAgentMemory(props.agentId)
    content.value = text
    originalContent.value = text
  } finally {
    loading.value = false
  }
  testActionSet('memory.edit', () => handleEdit())
  testActionSet('memory.save', () => handleSave())
})
onUnmounted(() => {
  testActionUnset('memory.edit')
  testActionUnset('memory.save')
})

function handleEdit() {
  editing.value = true
}

async function handleSave() {
  if (!isDirty.value) return
  saving.value = true
  try {
    await setAgentMemory(props.agentId, content.value)
    originalContent.value = content.value
    editing.value = false
    message.success(t('claw.agent.memorySaveSuccess'))
  } catch {
    message.error(t('claw.agent.memorySaveFailed'))
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="p-5">
    <div class="flex items-center justify-between mb-5">
      <div class="text-base font-semibold text-gray-800 dark:text-gray-100">
        {{ t('claw.agent.memoryTitle') }}
      </div>
      <a-button v-if="!editing" @click="handleEdit">
        <div class="inline-flex items-center gap-1">
          <Pencil class="w-4 h-4" aria-hidden="true" />
          {{ t('claw.agent.memoryEdit') }}
        </div>
      </a-button>
      <a-button
        v-else
        type="primary"
        :disabled="!isDirty || saving"
        :loading="saving"
        @click="handleSave"
      >
        <div class="inline-flex items-center gap-1">
          <Save v-if="!saving" class="w-4 h-4" aria-hidden="true" />
          {{ t('claw.agent.memorySave') }}
        </div>
      </a-button>
    </div>

    <div v-if="loading" class="text-sm text-gray-400 py-4">
      {{ t('claw.agent.loading') }}
    </div>

    <template v-else>
      <template v-if="!editing">
        <div
          v-if="!content"
          class="flex flex-col items-center justify-center py-16 text-gray-400"
        >
          <BrainCircuit class="w-12 h-12 mb-3 opacity-30" aria-hidden="true" />
          <div class="text-sm">{{ t('claw.agent.memoryEmpty') }}</div>
        </div>
        <MarkdownViewer v-else :content="content" />
      </template>
      <MarkdownEditor v-else v-model="content" :preview="false" />
    </template>
  </div>
</template>
