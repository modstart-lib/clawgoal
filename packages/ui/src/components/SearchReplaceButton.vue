<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import ReplaceAll from '~icons/lucide/replace-all'

const { t } = useI18n()

const props = defineProps<{
  /** 要搜索替换的目标对象（会被 JSON 序列化处理），通常是步骤数组 */
  modelValue: any
}>()
const emit = defineEmits<{ 'update:modelValue': [value: any] }>()

const open = ref(false)
const searchText = ref('')
const replaceText = ref('')
const replaceCount = ref<number | null>(null)

function openModal() {
  searchText.value = ''
  replaceText.value = ''
  replaceCount.value = null
  open.value = true
}

function handleReplace() {
  if (!searchText.value) return
  const json = JSON.stringify(props.modelValue)
  const escaped = searchText.value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const regex = new RegExp(escaped, 'g')
  let count = 0
  const replaced = json.replace(regex, () => {
    count++
    return replaceText.value
  })
  replaceCount.value = count
  if (count > 0) {
    emit('update:modelValue', JSON.parse(replaced))
  }
}

function handleCancel() {
  open.value = false
}

function handleOk() {
  open.value = false
}
</script>

<template>
  <a-button @click="openModal">
    <div class="inline-flex items-center gap-1">
      <ReplaceAll class="w-4 h-4" aria-hidden="true" />
      {{ t('searchReplaceButton.title') }}
    </div>
  </a-button>

  <a-modal
    :open="open"
    :title="t('searchReplaceButton.title')"
    :footer="null"
    width="min(600px, 90vw)"
    :keyboard="false"
    @cancel="handleCancel"
  >
    <div class="py-2 space-y-4">
      <div class="flex items-center gap-3">
        <span class="w-16 text-right shrink-0 text-sm text-gray-600">{{
          t('searchReplaceButton.search')
        }}</span>
        <a-input
          v-model:value="searchText"
          :placeholder="t('searchReplaceButton.search')"
          class="flex-1 font-mono"
          allow-clear
        />
      </div>
      <div class="flex items-center gap-3">
        <span class="w-16 text-right shrink-0 text-sm text-gray-600">{{
          t('searchReplaceButton.replace')
        }}</span>
        <a-input
          v-model:value="replaceText"
          :placeholder="t('searchReplaceButton.replacePlaceholder')"
          class="flex-1 font-mono"
          allow-clear
        />
      </div>
      <div
        v-if="replaceCount !== null"
        class="text-sm px-1"
        :class="replaceCount > 0 ? 'text-green-600' : 'text-gray-400'"
      >
        {{
          replaceCount > 0
            ? t('searchReplaceButton.replacedN', { n: replaceCount })
            : t('searchReplaceButton.noMatch')
        }}
      </div>
      <div class="flex justify-end gap-2 pt-1">
        <a-button @click="handleCancel">{{ t('common.cancel') }}</a-button>
        <a-button :disabled="!searchText" @click="handleReplace">{{
          t('searchReplaceButton.title')
        }}</a-button>
        <a-button type="primary" @click="handleOk">{{
          t('searchReplaceButton.done')
        }}</a-button>
      </div>
    </div>
  </a-modal>
</template>
