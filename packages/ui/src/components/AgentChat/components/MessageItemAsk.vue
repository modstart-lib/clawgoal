<template>
  <div
    class="shadow-sm rounded-lg bg-gray-50 mt-2 dark:bg-gray-800 overflow-hidden"
  >
    <div v-if="isCompleted" class="p-4">
      <div
        class="flex items-center gap-2 text-gray-600 dark:text-gray-400 mb-4"
      >
        <Check class="w-4 h-4" />
        <span class="text-sm font-medium">{{
          $t('agentChat.answeredN', { count: localAsks.length })
        }}</span>
      </div>
      <div class="space-y-3">
        <div v-for="(ask, index) in localAsks" :key="index" class="text-sm">
          <div class="text-base text-gray-700 dark:text-gray-300 mb-1">
            <MarkdownViewer :content="ask.question" />
          </div>
          <div
            class="text-gray-600 dark:text-gray-400 pl-3 border-l-2 border-blue-400"
          >
            {{ ask.optionSelected }}
          </div>
        </div>
      </div>
    </div>

    <div v-else class="p-4">
      <div class="mb-4">
        <div class="text-base text-gray-800 dark:text-gray-200">
          <MarkdownViewer :content="currentAsk.question" />
        </div>
        <div class="space-y-2">
          <div
            v-for="(option, index) in currentAsk.options"
            :key="index"
            class="w-full flex items-start gap-3 p-2 rounded-lg border transition-all text-left cursor-pointer"
            :class="
              currentAsk.optionActive === index + 1
                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30'
                : 'border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 hover:border-gray-300'
            "
            @click="selectOption(index + 1)"
          >
            <div
              class="shrink-0 w-5 h-5 rounded-full border flex items-center justify-center text-xs font-medium"
              :class="
                currentAsk.optionActive === index + 1
                  ? 'border-blue-500 bg-blue-500 text-white'
                  : 'border-gray-300 dark:border-gray-500 text-gray-500 dark:text-gray-400'
              "
            >
              {{ index + 1 }}
            </div>
            <div class="flex-1 text-sm text-gray-700 dark:text-gray-300">
              {{ option }}
            </div>
            <Check
              v-if="currentAsk.optionActive === index + 1"
              class="w-5 h-5 text-blue-500 shrink-0"
            />
            <div v-else class="w-5 h-5 shrink-0"></div>
          </div>

          <div
            class="w-full flex items-start gap-3 p-2 rounded-lg border transition-all"
            :class="
              currentAsk.optionActive === -1
                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30'
                : 'border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700'
            "
          >
            <div
              class="shrink-0 w-5 h-5 rounded-full border flex items-center justify-center text-xs font-medium"
              :class="
                currentAsk.optionActive === -1
                  ? 'border-blue-500 bg-blue-500 text-white'
                  : 'border-gray-300 text-gray-500'
              "
            >
              <Edit3 class="w-3 h-3" />
            </div>
            <a-textarea
              v-model:value="currentAsk.optionInput"
              :placeholder="$t('agentChat.otherOption')"
              class="flex-1"
              :auto-size="{ minRows: 1, maxRows: 6 }"
              @input="handleCustomInput"
              @focus="handleCustomInputFocus"
            />
            <Check
              v-if="currentAsk.optionActive === -1"
              class="w-5 h-5 text-blue-500 shrink-0"
            />
          </div>
        </div>
      </div>

      <!-- 底部导航和提交 -->
      <div class="mt-4 pt-4 border-t border-gray-200">
        <!-- 题目导航 -->
        <div class="flex justify-between items-center mb-3">
          <div class="text-sm text-gray-500">
            {{ currentIndex + 1 }}/{{ localAsks.length }}
          </div>
          <div class="flex gap-2">
            <a-button
              type="default"
              class="inline-flex items-center"
              :disabled="currentIndex === 0"
              @click="prevQuestion"
            >
              <ChevronLeft class="w-4 h-4" aria-hidden="true" />
            </a-button>
            <a-button
              type="default"
              class="inline-flex items-center"
              :disabled="currentIndex === localAsks.length - 1"
              @click="nextQuestion"
            >
              <ChevronRight class="w-4 h-4" aria-hidden="true" />
            </a-button>
          </div>
        </div>

        <!-- 提交按钮 -->
        <a-button
          type="primary"
          block
          :disabled="isSubmitting"
          :loading="isSubmitting"
          @click="submitAnswers"
        >
          {{
            isSubmitting
              ? $t('agentChat.submitting')
              : $t('agentChat.submitAnswer')
          }}
        </a-button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import MarkdownViewer from '@/components/MarkdownViewer.vue'
import { Button as AButton, Textarea as ATextarea } from 'ant-design-vue'
import Check from '~icons/lucide/check'
import ChevronLeft from '~icons/lucide/chevron-left'
import ChevronRight from '~icons/lucide/chevron-right'
import Edit3 from '~icons/lucide/edit-3'
import { computed, ref, watch } from 'vue'
import type { MessageAsk } from '../types'

const props = defineProps<{
  asks: MessageAsk[]
}>()

const emit = defineEmits<{
  (e: 'submit', asks: MessageAsk[]): void
}>()

const currentIndex = ref(0)

const localAsks = ref<MessageAsk[]>([])

const isSubmitting = ref(false)

watch(
  () => props.asks,
  (newAsks) => {
    localAsks.value = JSON.parse(JSON.stringify(newAsks))
  },
  { immediate: true, deep: true }
)

const currentAsk = computed(() => localAsks.value[currentIndex.value])

const isCompleted = computed(() => {
  return localAsks.value.every((ask) => ask.optionSelected)
})

const selectOption = (optionIndex: number) => {
  currentAsk.value.optionActive = optionIndex
}

const handleCustomInput = () => {
  if (currentAsk.value.optionInput && currentAsk.value.optionInput.trim()) {
    currentAsk.value.optionActive = -1
  }
}

const handleCustomInputFocus = () => {
  if (currentAsk.value.optionInput && currentAsk.value.optionInput.trim()) {
    currentAsk.value.optionActive = -1
  }
}

const prevQuestion = () => {
  if (currentIndex.value > 0) {
    currentIndex.value--
  }
}

const nextQuestion = () => {
  if (currentIndex.value < localAsks.value.length - 1) {
    currentIndex.value++
  }
}

const submitAnswers = () => {
  if (isSubmitting.value) {
    return
  }

  isSubmitting.value = true

  localAsks.value.forEach((ask) => {
    if (ask.optionActive === -1) {
      ask.optionSelected = ask.optionInput || ''
    } else {
      ask.optionSelected = ask.options[ask.optionActive - 1]
    }
  })

  emit('submit', localAsks.value)
}
</script>
