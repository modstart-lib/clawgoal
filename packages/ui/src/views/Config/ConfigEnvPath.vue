<script setup lang="ts">
/**
 * ConfigEnvPath — Shell PATH 配置弹窗
 *
 * Props:
 *   open  boolean  控制弹窗显示/隐藏
 *
 * Emits:
 *   update:open  (val: boolean) => void
 */
import { message } from 'ant-design-vue'
import ChevronDown from '~icons/lucide/chevron-down'
import ChevronUp from '~icons/lucide/chevron-up'
import Plus from '~icons/lucide/plus'
import Trash2 from '~icons/lucide/trash-2'
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { userParamGetJson, userParamSetJson } from '../../api/userParam'
import SystemDirSelectorButton from '@/components/SystemDirSelectorButton.vue'

const { t } = useI18n()

const SHELL_PATH_OPTION = 'ShellPathList'

const props = defineProps<{
  open: boolean
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
}>()

const pathList = ref<string[]>([])
const pathSaving = ref(false)

watch(
  () => props.open,
  async (val) => {
    if (!val) return
    try {
      const parsed = await userParamGetJson<unknown[]>(SHELL_PATH_OPTION, [])
      pathList.value = Array.isArray(parsed)
        ? (parsed.filter((p: unknown) => typeof p === 'string') as string[])
        : []
    } catch {
      pathList.value = []
      message.error(t('config.shellPathLoadFailed'))
    }
  },
  { immediate: false }
)

function addPath() {
  pathList.value.push('')
}

function removePath(index: number) {
  pathList.value.splice(index, 1)
}

function movePathUp(index: number) {
  if (index === 0) return
  const arr = [...pathList.value]
  ;[arr[index - 1], arr[index]] = [arr[index], arr[index - 1]]
  pathList.value = arr
}

function movePathDown(index: number) {
  const arr = [...pathList.value]
  if (index === arr.length - 1) return
  ;[arr[index], arr[index + 1]] = [arr[index + 1], arr[index]]
  pathList.value = arr
}

async function handleOk() {
  pathSaving.value = true
  try {
    const cleaned = pathList.value
      .map((p) => p.trim())
      .filter((p) => p.length > 0)
    await userParamSetJson(SHELL_PATH_OPTION, cleaned)
    pathList.value = cleaned
    message.success(t('config.shellPathSaveSuccess'))
    emit('update:open', false)
  } catch {
    message.error(t('config.shellPathSaveFailed'))
  } finally {
    pathSaving.value = false
  }
}

function handleCancel() {
  emit('update:open', false)
}
</script>

<template>
  <a-modal
    :keyboard="false"
    :mask-closable="false"
    :open="open"
    :title="$t('config.shellPathTitle')"
    :ok-text="$t('common.save')"
    :cancel-text="$t('common.cancel')"
    :confirm-loading="pathSaving"
    width="95vw"
    @ok="handleOk"
    @cancel="handleCancel"
  >
    <div class="mt-4">
      <p class="text-sm text-gray-500 dark:text-gray-400 mb-4">
        {{ $t('config.shellPathDesc') }}
      </p>

      <!-- Path list -->
      <div v-if="pathList.length === 0" class="text-center text-gray-400 py-6">
        {{ $t('config.shellPathEmpty') }}
      </div>
      <div v-else class="space-y-2 mb-3">
        <div
          v-for="(_, index) in pathList"
          :key="index"
          class="flex items-center gap-2"
        >
          <a-input
            v-model:value="pathList[index]"
            :placeholder="$t('config.shellPathPlaceholder')"
            class="flex-1 font-mono text-sm"
          />
          <SystemDirSelectorButton @select="(p) => (pathList[index] = p)" />
          <div class="flex gap-1 shrink-0">
            <a-button
              class="inline-flex items-center"
              :disabled="index === 0"
              :title="$t('common.moveUp')"
              @click="movePathUp(index)"
            >
              <ChevronUp class="w-4 h-4" aria-hidden="true" />
            </a-button>
            <a-button
              class="inline-flex items-center"
              :disabled="index === pathList.length - 1"
              :title="$t('common.moveDown')"
              @click="movePathDown(index)"
            >
              <ChevronDown class="w-4 h-4" aria-hidden="true" />
            </a-button>
            <a-button
              class="inline-flex items-center"
              danger
              @click="removePath(index)"
            >
              <Trash2 class="w-4 h-4" aria-hidden="true" />
            </a-button>
          </div>
        </div>
      </div>

      <!-- Add path button -->
      <a-button type="dashed" block @click="addPath">
        <div class="inline-flex items-center gap-1">
          <Plus class="w-4 h-4" aria-hidden="true" />
          {{ $t('config.shellPathAdd') }}
        </div>
      </a-button>
    </div>
  </a-modal>
</template>
