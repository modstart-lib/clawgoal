<template>
  <a-modal
    :keyboard="false"
    :mask-closable="false"
    :open="open"
    :title="
      $t('claw.resource.runnerModalTitle', { title: connector?.title ?? '' })
    "
    :footer="null"
    width="95vw"
    @cancel="emit('update:open', false)"
  >
    <!-- 顶部操作栏 -->
    <div class="flex items-center justify-between mb-3">
      <span class="text-sm text-gray-500">{{
        $t('claw.resource.runnerCount', { count: localRunners.length })
      }}</span>
      <a-button :loading="syncing" @click="handleRefresh">
        <div class="inline-flex items-center gap-1">
          <RefreshCw class="w-4 h-4" aria-hidden="true" />
          {{ $t('common.refresh') }}
        </div>
      </a-button>
    </div>

    <!-- Runner 列表 -->
    <div v-if="localRunners.length > 0" class="space-y-1.5">
      <div
        v-for="runner in localRunners"
        :key="runner.name"
        class="flex items-center justify-between px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-700/50 border border-gray-100 dark:border-gray-600"
      >
        <div class="flex items-center gap-2 min-w-0">
          <IDEIcon :name="runner.name" :size="16" class="shrink-0" />
          <div class="min-w-0">
            <p
              class="text-sm font-medium text-gray-800 dark:text-gray-200 truncate"
            >
              {{ runner.title }}
            </p>
            <p class="text-[11px] text-gray-400 font-mono">
              {{ runner.name }}
            </p>
          </div>
          <span
            v-if="runner.status"
            class="text-[10px] px-1.5 py-0.5 rounded-full border"
            :class="
              runner.status === 'online'
                ? 'bg-green-50 text-green-600 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800'
                : 'bg-gray-100 text-gray-400 border-gray-200 dark:bg-gray-700 dark:text-gray-500 dark:border-gray-600'
            "
            >{{ runner.status }}</span
          >
        </div>
        <a-switch
          :checked="runner.enable !== false"
          :loading="togglingMap[runner.name]"
          @change="handleSwitchChange(runner.name, $event)"
        />
      </div>
    </div>

    <div v-else class="py-10 text-center text-sm text-gray-400">
      {{ $t('claw.resource.noSyncedRunners') }}
    </div>
  </a-modal>
</template>

<script setup lang="ts">
import {
  type RuntimeRow,
  type RunnerInfo,
  getRuntimeList,
  requestRuntimeSync,
  setRunnerEnable,
} from '@/claw/api/runtime'
import IDEIcon from '@/components/IDEIcon.vue'
import { systemWs } from '@/utils/system'
import { message } from 'ant-design-vue'
import { onMounted, onUnmounted, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import RefreshCw from '~icons/lucide/refresh-cw'
import { testActionSet, testActionUnset } from '@/utils/test'

const props = defineProps<{ open: boolean; connector: RuntimeRow | null }>()
const emit = defineEmits<{
  (e: 'update:open', val: boolean): void
  (e: 'updated', row: RuntimeRow): void
}>()

const { t } = useI18n()

const localRunners = ref<RunnerInfo[]>([])
const syncing = ref(false)
const togglingMap = reactive<Record<string, boolean>>({})

watch(
  () => props.open,
  (val) => {
    if (val && props.connector) {
      localRunners.value = [...(props.connector.runners ?? [])]
      systemWs.onThrottle('claw:runtime:runnersUpdated', onRunnersUpdated)
    } else {
      systemWs.offThrottle('claw:runtime:runnersUpdated', onRunnersUpdated)
    }
  }
)

const onRunnersUpdated = async (data: Record<string, unknown>) => {
  if (!props.connector || data.runtimeId !== props.connector.id) return
  await refreshFromDb()
}

const refreshFromDb = async () => {
  if (!props.connector) return
  const list = await getRuntimeList()
  const updated = list.find((c) => c.id === props.connector!.id)
  if (updated) {
    localRunners.value = [...(updated.runners ?? [])]
    emit('updated', updated)
  }
}

const handleRefresh = async () => {
  if (!props.connector) return
  syncing.value = true
  try {
    await requestRuntimeSync(props.connector.id)
    await new Promise((res) => setTimeout(res, 500))
    await refreshFromDb()
    message.success(t('claw.resource.dataRefreshed'))
  } catch {
    message.error(t('claw.resource.refreshFailed'))
  } finally {
    syncing.value = false
  }
}

const handleSwitchChange = (name: string, val: unknown) => {
  handleToggleEnable(name, !!val)
}

const handleToggleEnable = async (name: string, enable: boolean) => {
  if (!props.connector) return
  togglingMap[name] = true
  try {
    const updated = await setRunnerEnable({
      id: props.connector.id,
      name,
      enable,
    })
    localRunners.value = [...(updated.runners ?? [])]
    emit('updated', updated)
  } catch {
    message.error(t('claw.resource.operateFailed'))
  } finally {
    togglingMap[name] = false
  }
}

onMounted(() => {
  testActionSet('list.refresh', () => handleRefresh())
})

onUnmounted(() => {
  testActionUnset('list.refresh')
})
</script>
