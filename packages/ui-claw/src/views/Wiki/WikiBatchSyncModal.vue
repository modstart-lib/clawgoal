<template>
  <a-modal
    :keyboard="false"
    :mask-closable="false"
    :open="open"
    :title="t('claw.project.wikiBatchAddTitle')"
    :confirm-loading="saving"
    width="min(600px, 90vw)"
    :ok-text="t('claw.project.wikiBatchAddOk')"
    @ok="handleSave"
    @cancel="handleCancel"
    @update:open="emit('update:open', $event)"
  >
    <div class="space-y-4 py-2">
      <!-- 模式切换 -->
      <a-radio-group
        v-model:value="mode"
        button-style="solid"
        :disabled="saving"
      >
        <a-radio-button value="url">{{
          t('claw.project.wikiBatchModeUrl')
        }}</a-radio-button>
        <a-radio-button value="path">{{
          t('claw.project.wikiBatchModePath')
        }}</a-radio-button>
      </a-radio-group>
      <!-- 说明文字 -->
      <div class="text-sm text-gray-500 dark:text-gray-400">
        {{
          mode === 'url'
            ? t('claw.project.wikiBatchAddDesc')
            : t('claw.project.wikiBatchPathDesc')
        }}
      </div>
      <a-textarea
        v-model:value="inputText"
        :rows="12"
        :placeholder="
          mode === 'url'
            ? t('claw.project.wikiBatchUrlPlaceholder')
            : t('claw.project.wikiBatchPathPlaceholder')
        "
        allow-clear
      />
      <!-- 进度 -->
      <div v-if="progress.total > 0" class="space-y-2">
        <a-progress
          :percent="Math.round((progress.done / progress.total) * 100)"
          :status="progress.done === progress.total ? 'success' : 'active'"
        />
        <div class="text-xs text-gray-500 dark:text-gray-400">
          {{
            t('claw.project.wikiBatchProgress', {
              done: progress.done,
              total: progress.total,
            })
          }}
          <span v-if="progress.failed > 0" class="text-red-500 ml-2">{{
            t('claw.project.wikiBatchFailed', { count: progress.failed })
          }}</span>
        </div>
        <!-- 失败列表 -->
        <div
          v-if="failedItems.length > 0"
          class="mt-2 max-h-40 overflow-y-auto rounded bg-red-50 dark:bg-red-900/20 p-2 text-xs text-red-600 dark:text-red-400 space-y-1"
        >
          <div v-for="(item, i) in failedItems" :key="i">
            <div class="truncate font-medium">{{ item.value }}</div>
            <div
              v-if="item.error"
              class="text-red-400 dark:text-red-500 pl-2 truncate"
            >
              {{ item.error }}
            </div>
          </div>
        </div>
      </div>
    </div>
  </a-modal>
</template>

<script setup lang="ts">
import { addWiki } from '@/claw/api/wiki'
import { message } from 'ant-design-vue'
import { onMounted, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { testActionSet, testActionUnset } from '@/utils/test'

const props = defineProps<{
  open: boolean
  projectId: number
}>()

const emit = defineEmits<{
  (e: 'update:open', value: boolean): void
  (e: 'refresh'): void
}>()

const { t } = useI18n()
const saving = ref(false)
const mode = ref<'url' | 'path'>('url')
const inputText = ref('')
const progress = ref({ total: 0, done: 0, failed: 0 })
const failedItems = ref<{ value: string; error: string }[]>([])

watch(
  () => props.open,
  (val) => {
    if (!val) {
      inputText.value = ''
      mode.value = 'url'
      progress.value = { total: 0, done: 0, failed: 0 }
      failedItems.value = []
    }
  }
)

const handleCancel = () => {
  emit('update:open', false)
}

const handleSave = async () => {
  const rawItems = inputText.value
    .split('\n')
    .map((u) => u.trim())
    .filter((u) => u.length > 0)
  const items = [...new Set(rawItems)]

  if (items.length === 0) {
    message.warning(
      mode.value === 'url'
        ? t('claw.project.wikiBatchUrlRequired')
        : t('claw.project.wikiBatchPathRequired')
    )
    return
  }

  if (items.length < rawItems.length) {
    message.info(
      t('claw.project.wikiBatchDedup', {
        total: items.length,
        removed: rawItems.length - items.length,
      })
    )
  }

  saving.value = true
  progress.value = { total: items.length, done: 0, failed: 0 }
  failedItems.value = []

  for (const item of items) {
    try {
      if (mode.value === 'url') {
        await addWiki({
          projectId: props.projectId,
          title: item,
          type: 'syncUrl',
          syncUrl: item,
          sourceUrl: item,
          syncInterval: 1,
        })
      } else {
        await addWiki({
          projectId: props.projectId,
          title: item,
          type: 'syncPath',
          syncPath: item,
          syncInterval: 1,
        })
      }
    } catch (e: any) {
      progress.value.failed++
      failedItems.value.push({
        value: item,
        error: e?.message || e?.msg || String(e),
      })
    } finally {
      progress.value.done++
    }
  }

  saving.value = false

  if (progress.value.failed === 0) {
    message.success(
      t('claw.project.wikiBatchAddSuccess', { count: items.length })
    )
    emit('update:open', false)
    emit('refresh')
  } else {
    message.warning(
      t('claw.project.wikiBatchAddPartial', {
        success: items.length - progress.value.failed,
        failed: progress.value.failed,
      })
    )
    emit('refresh')
  }
}

onMounted(() => {
  testActionSet('modal.submit', () => handleSave())
  testActionSet('modal.close', () => emit('update:open', false))
})

onUnmounted(() => {
  testActionUnset('modal.submit')
  testActionUnset('modal.close')
})
</script>
