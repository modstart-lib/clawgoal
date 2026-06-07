<script setup lang="ts">
import {
  noticeAdd,
  noticeDelete,
  noticeEdit,
  noticeList,
  noticeTest,
  type NoticeItem,
} from '@/api/notice'
import ListerTop from '@/components/ListerTop.vue'
import LoadingState from '@/components/LoadingState.vue'
import { message } from 'ant-design-vue'
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import Bell from '~icons/lucide/bell'
import Clock from '~icons/lucide/clock'
import Copy from '~icons/lucide/copy'
import Pencil from '~icons/lucide/pencil'
import Plus from '~icons/lucide/plus'
import Send from '~icons/lucide/send'
import Settings from '~icons/lucide/settings'
import Trash2 from '~icons/lucide/trash-2'
import SettingNoticeEditModal from './SettingNotice/SettingNoticeEditModal.vue'
import SettingNoticeLogModal from './SettingNotice/SettingNoticeLogModal.vue'
import SettingNoticeSettingModal from './SettingNotice/SettingNoticeSettingModal.vue'
import SettingProxyViewer from './SettingProxy/SettingProxyViewer.vue'

const { t } = useI18n()

const TYPE_LABELS = computed(
  () =>
    ({
      url: 'Webhook URL',
      email: 'Email',
      dingtalk: t('settingNotice.typeNameDingtalk'),
      feishu: t('settingNotice.typeNameFeishu'),
      wework: t('settingNotice.typeNameWework'),
      telegram: 'Telegram',
      slack: 'Slack',
      ntfy: 'Ntfy',
    }) as Record<string, string>
)

const loading = ref(false)
const testingId = ref<number | null>(null)
const notices = ref<NoticeItem[]>([])

const editModalVisible = ref(false)
const editingItem = ref<Partial<NoticeItem> | null>(null)

const logModalVisible = ref(false)
const settingsModalVisible = ref(false)

const columns = computed(() => [
  { title: t('settingNotice.columnTitle'), key: 'title', dataIndex: 'title' },
  { title: t('settingNotice.columnType'), key: 'type', width: 130 },
  { title: t('settingNotice.columnStatus'), key: 'enable', width: 90 },
  { title: t('settingNotice.columnRateLimit'), key: 'rateLimit', width: 130 },
  { title: t('settingNotice.columnProxy'), key: 'proxy', width: 120 },
  { title: t('settingNotice.columnActions'), key: 'actions', width: 280 },
])

onMounted(load)

async function load() {
  loading.value = true
  try {
    notices.value = await noticeList()
  } finally {
    loading.value = false
  }
}

function openAdd() {
  editingItem.value = null
  editModalVisible.value = true
}

function openEdit(item: NoticeItem) {
  editingItem.value = item
  editModalVisible.value = true
}

function openCopy(item: NoticeItem) {
  const { id, userId, createdAt, updatedAt, ...copyData } = item
  editingItem.value = copyData
  editModalVisible.value = true
}

async function handleSaved(data: NoticeItem) {
  try {
    if (data.id) {
      await noticeEdit(data)
      message.success(t('settingNotice.editSuccess'))
    } else {
      await noticeAdd(data)
      message.success(t('settingNotice.addSuccess'))
    }
    editModalVisible.value = false
    await load()
  } catch (e: unknown) {
    message.error(
      e instanceof Error ? e.message : t('settingNotice.operationFailed')
    )
  }
}

async function handleDelete(id: number) {
  try {
    await noticeDelete(id)
    message.success(t('settingNotice.deleteSuccess'))
    await load()
  } catch (e: unknown) {
    message.error(
      e instanceof Error ? e.message : t('settingNotice.deleteFailed')
    )
  }
}

async function handleTest(id: number) {
  testingId.value = id
  try {
    await noticeTest(id)
    message.success(t('settingNotice.testSuccess'))
  } catch (e: unknown) {
    message.error(
      e instanceof Error ? e.message : t('settingNotice.testFailed')
    )
  } finally {
    testingId.value = null
  }
}

async function toggleEnable(item: NoticeItem) {
  try {
    await noticeEdit({ id: item.id, enable: !item.enable })
    await load()
  } catch (e: unknown) {
    message.error(
      e instanceof Error ? e.message : t('settingNotice.operationFailed')
    )
  }
}
</script>

<template>
  <div>
    <LoadingState :loading="loading && notices.length === 0">
      <ListerTop :loading="loading" :total="notices.length" @refresh="load">
        <template #actions>
          <a-button @click="settingsModalVisible = true">
            <div class="inline-flex items-center gap-1">
              <Settings class="w-4 h-4" aria-hidden="true" />
              {{ $t('settingNoticeMain.functionSettings') }}
            </div>
          </a-button>
          <a-button @click="logModalVisible = true">
            <div class="inline-flex items-center gap-1">
              <Clock class="w-4 h-4" aria-hidden="true" />
              {{ $t('settingNotice.history') }}
            </div>
          </a-button>
          <a-button type="primary" @click="openAdd">
            <div class="inline-flex items-center gap-1">
              <Plus class="w-4 h-4" aria-hidden="true" />
              {{ $t('settingNotice.add') }}
            </div>
          </a-button>
        </template>
      </ListerTop>

      <!-- Table -->
      <div
        class="rounded-xl border border-gray-100/80 dark:border-gray-700/50 bg-surface/50 dark:bg-panel/30 backdrop-blur-md overflow-hidden"
      >
        <a-table
          :data-source="notices"
          :columns="columns"
          :pagination="false"
          row-key="id"
          :locale="{ emptyText: $t('settingNotice.noData') }"
          :scroll="{ x: 'max-content' }"
        >
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'title'">
              <div class="flex items-center gap-2">
                <Bell
                  class="w-4 h-4 text-primary shrink-0"
                  aria-hidden="true"
                />
                <span class="font-medium text-gray-900 dark:text-gray-100">{{
                  record.title
                }}</span>
              </div>
            </template>

            <template v-else-if="column.key === 'type'">
              <a-tag>{{ TYPE_LABELS[record.type] ?? record.type }}</a-tag>
            </template>

            <template v-else-if="column.key === 'enable'">
              <a-switch
                :checked="record.enable"
                :loading="loading"
                @change="toggleEnable(record)"
              />
            </template>

            <template v-else-if="column.key === 'rateLimit'">
              <span v-if="record.rateLimitEnable" class="text-xs text-gray-500">
                {{
                  $t('settingNotice.ratePerInterval', {
                    interval: record.rateInterval,
                  })
                }}
              </span>
              <span v-else class="text-xs text-gray-400">{{
                $t('settingNotice.noRateLimit')
              }}</span>
            </template>

            <template v-else-if="column.key === 'proxy'">
              <SettingProxyViewer :proxy-name="record.proxyName ?? undefined" />
              <span v-if="!record.proxyName" class="text-xs text-gray-400"
                >—</span
              >
            </template>

            <template v-else-if="column.key === 'actions'">
              <a-space>
                <a-button
                  :loading="testingId === record.id"
                  @click="handleTest(record.id)"
                >
                  <div class="inline-flex items-center gap-1">
                    <Send
                      v-if="testingId !== record.id"
                      class="w-4 h-4"
                      aria-hidden="true"
                    />
                    {{ $t('settingNotice.test') }}
                  </div>
                </a-button>
                <a-button @click="openEdit(record)">
                  <div class="inline-flex items-center gap-1">
                    <Pencil class="w-4 h-4" aria-hidden="true" />
                    {{ $t('settingNotice.edit') }}
                  </div>
                </a-button>
                <a-button @click="openCopy(record)">
                  <div class="inline-flex items-center gap-1">
                    <Copy class="w-4 h-4" aria-hidden="true" />
                    {{ $t('settingNoticeMain.copy') }}
                  </div>
                </a-button>
                <a-popconfirm
                  :title="$t('settingNotice.deleteConfirm')"
                  @confirm="handleDelete(record.id)"
                >
                  <a-button danger>
                    <div class="inline-flex items-center gap-1">
                      <Trash2 class="w-4 h-4" aria-hidden="true" />
                      {{ $t('settingNotice.delete') }}
                    </div>
                  </a-button>
                </a-popconfirm>
              </a-space>
            </template>
          </template>
        </a-table>
      </div>
    </LoadingState>

    <!-- 编辑弹窗 -->
    <SettingNoticeEditModal
      v-model:open="editModalVisible"
      :initial="editingItem"
      @saved="handleSaved"
    />

    <!-- 历史弹窗 -->
    <SettingNoticeLogModal v-model:open="logModalVisible" />

    <!-- 功能设置弹窗 -->
    <SettingNoticeSettingModal v-model:open="settingsModalVisible" />
  </div>
</template>

<style scoped></style>
