<script setup lang="ts">
import {
  getCronLogs,
  getCronLiveLog,
  type CronLog,
  type CronTask,
} from '@/claw/api/cron'
import DatetimeViewer from '@/components/DatetimeViewer.vue'
import ListerTop from '@/components/ListerTop.vue'
import LoadingState from '@/components/LoadingState.vue'
import type { Agent } from '@/types'
import { message } from 'ant-design-vue'
import { type Dayjs } from 'dayjs'
import Bot from '~icons/lucide/bot'
import CalendarClock from '~icons/lucide/calendar-clock'
import CircleCheck from '~icons/lucide/circle-check'
import Clock from '~icons/lucide/clock'
import FileText from '~icons/lucide/file-text'
import History from '~icons/lucide/history'
import Loader2 from '~icons/lucide/loader-2'
import ScrollText from '~icons/lucide/scroll-text'
import Terminal from '~icons/lucide/terminal'
import XCircle from '~icons/lucide/x-circle'
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { testActionSet, testActionUnset } from '@/utils/test'

const { t } = useI18n()

const props = defineProps<{
  open: boolean
  task?: CronTask | null
  agent?: Agent
}>()

const emit = defineEmits<{
  'update:open': [val: boolean]
}>()

const liveLogContent = ref('')
const liveLogVisible = ref(false)
let pollTimer: ReturnType<typeof setTimeout> | null = null

function stopPolling() {
  if (pollTimer) {
    clearTimeout(pollTimer)
    pollTimer = null
  }
}

async function pollLiveLog() {
  if (!props.task?.isRunning || !props.task) return
  try {
    const result = await getCronLiveLog(props.task.id)
    if (result.isRunning && result.content) {
      liveLogContent.value = result.content
    }
    if (result.isRunning) {
      pollTimer = setTimeout(pollLiveLog, 3000)
    } else {
      if (props.open && props.task) {
        logs.value = await getCronLogs(props.task.id, buildLogOptions())
      }
    }
  } catch {
    // ignore
  }
}

async function openLiveLog() {
  liveLogContent.value = t('claw.cron.fetchingLiveLog')
  liveLogVisible.value = true
  if (props.task) {
    const result = await getCronLiveLog(props.task.id)
    liveLogContent.value = result.content || t('claw.cron.noLogContent')
    if (result.isRunning) {
      pollTimer = setTimeout(pollLiveLog, 3000)
    }
  }
}

onMounted(() => {
  testActionSet('list.refresh', () => loadLogs(true))
})
onUnmounted(() => {
  stopPolling()
  testActionUnset('list.refresh')
})
const configTypeLabel = computed(() =>
  props.task?.config?.type === 'shell'
    ? t('claw.cron.configTypeShell')
    : t('claw.cron.configTypeAgent')
)
const configIcon = computed(() =>
  props.task?.config?.type === 'shell' ? Terminal : Bot
)
const configDetail = computed(() =>
  props.task?.config?.type === 'shell'
    ? props.task.config?.shell
    : props.task?.config?.agent
)

const logs = ref<CronLog[]>([])
const logsLoading = ref(false)

// 时间范围筛选
const dateRange = ref<[Dayjs, Dayjs] | null>(null)

function buildLogOptions() {
  return {
    startTime: dateRange.value
      ? dateRange.value[0].format('YYYY-MM-DD 00:00:00')
      : undefined,
    endTime: dateRange.value
      ? dateRange.value[1].format('YYYY-MM-DD 23:59:59')
      : undefined,
  }
}

async function loadLogs(showToast = false) {
  if (!props.task) return
  logsLoading.value = true
  stopPolling()
  try {
    logs.value = await getCronLogs(props.task.id, buildLogOptions())
    if (showToast) message.success(t('claw.cron.dataRefreshed'))
  } catch (e: any) {
    message.error(e.message || t('claw.cron.loadLogsFailed'))
  } finally {
    logsLoading.value = false
  }
}

watch(
  () => props.open,
  async (val) => {
    if (val && props.task) {
      await loadLogs()
    } else {
      stopPolling()
      liveLogVisible.value = false
    }
  }
)
</script>

<template>
  <a-modal
    :keyboard="false"
    :mask-closable="false"
    :open="open"
    :title="$t('claw.cron.detailTitle')"
    width="95vw"
    :footer="null"
    @cancel="emit('update:open', false)"
  >
    <template v-if="task">
      <div class="space-y-4 mt-2">
        <!-- 头部信息 -->
        <div
          class="flex items-center gap-3 pb-3 border-b border-gray-100 dark:border-gray-700"
        >
          <div
            class="w-12 h-12 rounded-xl overflow-hidden border-2 border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-700 shrink-0"
          >
            <img
              v-if="agent?.avatar"
              :src="agent.avatar"
              class="w-full h-full object-cover"
              alt=""
            />
            <div v-else class="w-full h-full flex items-center justify-center">
              <Bot class="w-6 h-6 text-gray-400" />
            </div>
          </div>
          <div class="flex-1 min-w-0">
            <div
              class="text-base font-semibold text-gray-900 dark:text-gray-100 truncate"
            >
              {{ task.name }}
            </div>
            <div
              v-if="agent?.title"
              class="text-xs text-gray-400 dark:text-gray-500"
            >
              {{ agent.title }}
            </div>
          </div>
          <a-tag v-if="task.status === 'enabled'" color="green">{{
            $t('claw.cron.tagEnabled')
          }}</a-tag>
          <a-tag v-else color="default">{{
            $t('claw.cron.tagDisabled')
          }}</a-tag>
        </div>

        <!-- 详细信息 -->
        <div class="bg-gray-50 dark:bg-gray-700 rounded-lg p-3 space-y-2.5">
          <div class="flex items-center gap-2">
            <Clock class="w-3.5 h-3.5 text-gray-400 shrink-0" />
            <span
              class="text-sm text-gray-500 dark:text-gray-400 w-20 shrink-0"
              >{{ $t('claw.cron.cronExprLabel') }}</span
            >
            <code
              class="text-sm font-mono bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 px-2 py-0.5 rounded"
            >
              {{ task.cron }}
            </code>
          </div>
          <div class="flex items-start gap-2">
            <component
              :is="configIcon"
              class="w-3.5 h-3.5 text-primary-400 shrink-0 mt-0.5"
            />
            <span
              class="text-sm text-gray-500 dark:text-gray-400 w-20 shrink-0"
              >{{ $t('claw.cron.actionTypeLabel') }}</span
            >
            <div class="flex flex-col gap-1">
              <span
                class="text-sm text-gray-800 dark:text-gray-200 font-medium"
                >{{ configTypeLabel }}</span
              >
              <code
                v-if="configDetail"
                class="text-xs font-mono bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 px-2 py-0.5 rounded break-all"
                >{{ configDetail }}</code
              >
            </div>
          </div>
          <div v-if="task.description" class="flex items-start gap-2">
            <FileText class="w-3.5 h-3.5 text-gray-400 shrink-0 mt-0.5" />
            <span
              class="text-sm text-gray-500 dark:text-gray-400 w-20 shrink-0"
              >{{ $t('claw.cron.taskDescLabel') }}</span
            >
            <span class="text-sm text-gray-800 dark:text-gray-200">{{
              task.description
            }}</span>
          </div>
          <div class="flex items-center gap-2">
            <History class="w-3.5 h-3.5 text-gray-400 shrink-0" />
            <span
              class="text-sm text-gray-500 dark:text-gray-400 w-20 shrink-0"
              >{{ $t('claw.cron.lastRunLabel') }}</span
            >
            <span class="text-sm text-gray-800 dark:text-gray-200"
              ><DatetimeViewer
                :value="task.lastRun"
                :fallback="$t('claw.cron.neverRun')"
            /></span>
          </div>
          <div class="flex items-center gap-2">
            <CalendarClock class="w-3.5 h-3.5 text-gray-400 shrink-0" />
            <span
              class="text-sm text-gray-500 dark:text-gray-400 w-20 shrink-0"
              >{{ $t('claw.cron.createdAtLabel') }}</span
            >
            <span class="text-sm text-gray-800 dark:text-gray-200"
              ><DatetimeViewer :value="task.createdAt"
            /></span>
          </div>
        </div>

        <!-- 执行日志 -->
        <div>
          <div
            class="flex items-center gap-1.5 font-medium text-gray-900 dark:text-gray-100 mb-2"
          >
            <ScrollText class="w-4 h-4 text-gray-500" />
            {{ $t('claw.cron.recentLogs') }}
          </div>
          <ListerTop
            :loading="logsLoading"
            :total="logs.length"
            @refresh="() => loadLogs(true)"
          >
            <a-range-picker
              v-model:value="dateRange"
              size="small"
              class="w-56!"
              :allow-clear="true"
              @change="loadLogs()"
            />
          </ListerTop>
          <LoadingState :loading="logsLoading">
            <div class="space-y-2">
              <!-- 正在运行的虚拟条目 -->
              <div
                v-if="task.isRunning"
                class="flex items-center gap-2 text-sm bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800/50 rounded-lg px-3 py-2"
              >
                <Loader2 class="w-4 h-4 text-blue-500 shrink-0 animate-spin" />
                <a-tag color="processing" class="!text-xs shrink-0">{{
                  $t('claw.cron.logRunning')
                }}</a-tag>
                <span class="text-blue-600 dark:text-blue-400 flex-1">{{
                  $t('claw.cron.logExecuting')
                }}</span>
                <a-button
                  type="text"
                  size="small"
                  class="!text-blue-500 shrink-0"
                  @click="openLiveLog"
                >
                  {{ $t('claw.cron.viewLiveLogBtn') }}
                </a-button>
              </div>
              <!-- 历史日志条目 -->
              <template v-if="logs.length">
                <div
                  v-for="log in logs"
                  :key="log.id"
                  class="flex items-center gap-2 text-sm bg-gray-50 dark:bg-gray-700 rounded-lg px-3 py-2"
                >
                  <CircleCheck
                    v-if="log.success"
                    class="w-4 h-4 text-green-500 shrink-0"
                  />
                  <XCircle v-else class="w-4 h-4 text-red-500 shrink-0" />
                  <a-tag
                    :color="log.success ? 'success' : 'error'"
                    class="!text-xs shrink-0"
                    >{{
                      log.success
                        ? $t('claw.cron.logSuccess')
                        : $t('claw.cron.logFail')
                    }}</a-tag
                  >
                  <span
                    class="text-gray-400 dark:text-gray-500 text-xs w-40 shrink-0"
                    ><DatetimeViewer :value="log.time"
                  /></span>
                  <span
                    :class="
                      log.success
                        ? 'text-green-600 dark:text-green-400'
                        : 'text-red-500'
                    "
                  >
                    {{ log.message }}
                  </span>
                </div>
              </template>
              <div
                v-else-if="!task.isRunning"
                class="text-sm text-gray-400 dark:text-gray-500 py-8 text-center border border-dashed border-gray-200 dark:border-gray-600 rounded-lg"
              >
                {{ $t('claw.cron.noLogs') }}
              </div>
            </div>
          </LoadingState>
        </div>
      </div>
    </template>
  </a-modal>

  <!-- 实时日志弹窗 -->
  <a-modal
    v-model:open="liveLogVisible"
    :title="$t('claw.cron.liveLogTitle')"
    width="95vw"
    :footer="null"
    :keyboard="false"
    :mask-closable="false"
    @cancel="stopPolling"
  >
    <div class="mt-2">
      <div
        v-if="task?.isRunning"
        class="flex items-center gap-2 text-xs text-blue-500 mb-2"
      >
        <Loader2 class="w-3.5 h-3.5 animate-spin" />
        <span>{{ $t('claw.cron.liveLogRefreshing') }}</span>
      </div>
      <pre
        class="bg-gray-900 text-gray-100 text-xs font-mono rounded-lg p-4 overflow-auto max-h-[70vh] whitespace-pre-wrap break-all"
        >{{ liveLogContent || $t('claw.cron.noLogContent') }}</pre
      >
    </div>
  </a-modal>
</template>
