<script setup lang="ts">
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { Plus, Trash2 } from 'lucide-vue-next'

const { t } = useI18n()

const props = defineProps<{ node: any; properties: any }>()
const emit = defineEmits<{ 'update:properties': [val: any] }>()

const question = ref<string>('')
const options = ref<Array<{ id: string; label: string }>>([])

watch(
  () => props.properties?.data,
  (d) => {
    question.value = d?.question || ''
    options.value = d?.options ? [...d.options] : []
  },
  { immediate: true }
)

function sync() {
  const opts = options.value
  emit('update:properties', {
    data: { question: question.value, options: opts },
    outputs: opts.map((o) => ({ id: o.id, type: 'output' })),
  })
}

function addOption() {
  const id = `opt_${Date.now()}`
  options.value.push({
    id,
    label: `${t('workflowEditor.asksOptionPlaceholder')} ${options.value.length + 1}`,
  })
  sync()
}

function removeOption(idx: number) {
  options.value.splice(idx, 1)
  sync()
}
</script>

<template>
  <div class="p-3 space-y-3">
    <div>
      <div class="text-xs text-gray-500 mb-1">
        {{ t('workflowEditor.asksQuestion') }}
      </div>
      <a-input
        v-model:value="question"
        :placeholder="t('workflowEditor.asksQuestionPlaceholder')"
        @change="sync"
      />
    </div>
    <div>
      <div class="flex items-center justify-between mb-1">
        <span class="text-xs text-gray-500">{{
          t('workflowEditor.asksOptions')
        }}</span>
        <a-button @click="addOption">
          <div class="inline-flex items-center gap-1">
            <Plus class="w-4 h-4" aria-hidden="true" />{{
              t('workflowEditor.asksAddOption')
            }}
          </div>
        </a-button>
      </div>
      <div class="space-y-1.5">
        <div
          v-for="(opt, idx) in options"
          :key="opt.id"
          class="flex items-center gap-2"
        >
          <a-input
            v-model:value="opt.label"
            :placeholder="`${t('workflowEditor.asksOptionPlaceholder')} ${idx + 1}`"
            class="flex-1"
            @change="sync"
          />
          <a-button
            class="inline-flex items-center"
            danger
            @click="removeOption(idx)"
          >
            <Trash2 class="w-4 h-4" aria-hidden="true" />
          </a-button>
        </div>
      </div>
      <div v-if="!options.length" class="text-xs text-gray-400 mt-1">
        {{ t('workflowEditor.asksMinOne') }}
      </div>
    </div>
  </div>
</template>
