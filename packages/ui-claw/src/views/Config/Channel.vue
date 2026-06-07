<template>
  <div>
    <LoadingState :loading="loading">
      <!-- 工具栏 -->
      <div class="flex justify-between items-center mb-4">
        <span class="text-sm text-gray-500 dark:text-gray-400">{{
          $t('config.channelCount', { count: channels.length })
        }}</span>
        <div class="flex gap-2">
          <a-button @click="loadList">
            <div class="inline-flex items-center gap-1">
              <RefreshCw class="w-4 h-4" aria-hidden="true" />
              {{ $t('common.refresh') }}
            </div>
          </a-button>
          <a-button type="primary" @click="openAdd">
            <div class="inline-flex items-center gap-1">
              <Plus class="w-4 h-4" aria-hidden="true" />
              {{ $t('common.add') }}
            </div>
          </a-button>
        </div>
      </div>

      <!-- 表格 -->
      <a-table
        :data-source="channels"
        :columns="columns"
        :pagination="false"
        row-key="id"
        :locale="{ emptyText: $t('config.channelEmpty') }"
        :scroll="{ x: 'max-content' }"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'type'">
            <a-tag :color="typeColor(record.type)">
              {{ typeLabel(record.type) }}
            </a-tag>
          </template>

          <template v-else-if="column.key === 'status'">
            <a-tag :color="record.status === 'success' ? 'success' : 'default'">
              {{
                record.status === 'success'
                  ? $t('config.channelStatusConnected')
                  : $t('config.channelStatusPending')
              }}
            </a-tag>
          </template>

          <template v-else-if="column.key === 'config'">
            <div class="flex flex-col gap-1 py-1">
              <div
                v-if="record.config?.token"
                class="flex items-center gap-1.5"
              >
                <Key class="w-3.5 h-3.5 text-primary-400 shrink-0" />
                <span
                  class="text-xs font-mono text-gray-500 dark:text-gray-400"
                >
                  {{ maskToken(record.config.token) }}
                </span>
              </div>
              <div
                v-if="record.config?.appId"
                class="flex items-center gap-1.5"
              >
                <Key class="w-3.5 h-3.5 text-primary-400 shrink-0" />
                <span
                  class="text-xs font-mono text-gray-500 dark:text-gray-400"
                >
                  {{ record.config.appId }}
                </span>
              </div>
              <div
                v-if="record.config?.appKey"
                class="flex items-center gap-1.5"
              >
                <Key class="w-3.5 h-3.5 text-primary-400 shrink-0" />
                <span
                  class="text-xs font-mono text-gray-500 dark:text-gray-400"
                >
                  {{ record.config.appKey }}
                </span>
              </div>
              <div
                v-if="record.config?.corpId"
                class="flex items-center gap-1.5"
              >
                <Key class="w-3.5 h-3.5 text-primary-400 shrink-0" />
                <span
                  class="text-xs font-mono text-gray-500 dark:text-gray-400"
                >
                  {{ record.config.corpId }}
                </span>
              </div>
              <div
                v-if="record.config?.chatId"
                class="flex items-center gap-1.5"
              >
                <MessageSquare class="w-3.5 h-3.5 text-gray-400 shrink-0" />
                <span class="text-xs text-gray-500 dark:text-gray-400"
                  >Chat: {{ record.config.chatId }}</span
                >
              </div>
              <div
                v-if="record.config?.toUser"
                class="flex items-center gap-1.5"
              >
                <MessageSquare class="w-3.5 h-3.5 text-gray-400 shrink-0" />
                <span class="text-xs text-gray-500 dark:text-gray-400"
                  >{{ t('config.channelToUserLabel') }}:
                  {{ record.config.toUser }}</span
                >
              </div>
            </div>
          </template>

          <template v-else-if="column.key === 'isGlobal'">
            <a-tag v-if="record.isGlobal" color="arcoblue">{{
              $t('config.channelGlobal')
            }}</a-tag>
            <span v-else class="text-xs text-gray-400">—</span>
          </template>

          <template v-else-if="column.key === 'enable'">
            <a-switch
              :checked="record.enable"
              :loading="togglingId === record.id"
              @change="(val: boolean) => toggleEnable(record, val)"
            />
          </template>

          <template v-else-if="column.key === 'actions'">
            <div class="flex gap-2 flex-wrap">
              <a-button type="default" @click="openEdit(record)">
                <div class="inline-flex items-center gap-1">
                  <Edit class="w-4 h-4" aria-hidden="true" />
                  {{ $t('config.channelEdit') }}
                </div>
              </a-button>
              <a-button
                type="default"
                :loading="testingId === record.id"
                @click="doTestSend(record)"
              >
                <div class="inline-flex items-center gap-1">
                  <Send class="w-4 h-4" aria-hidden="true" />
                  {{ $t('config.channelTestSend') }}
                </div>
              </a-button>
              <a-popconfirm
                :title="$t('config.channelDeleteConfirm')"
                :ok-text="$t('common.confirm')"
                :cancel-text="$t('common.cancel')"
                @confirm="doDelete(record.id)"
              >
                <a-button type="primary" danger>
                  <div class="inline-flex items-center gap-1">
                    <Trash2 class="w-4 h-4" aria-hidden="true" />
                    {{ $t('common.delete') }}
                  </div>
                </a-button>
              </a-popconfirm>
            </div>
          </template>
        </template>
      </a-table>
    </LoadingState>

    <!-- 编辑弹窗 -->
    <ChannelEditModal
      v-model:open="modalVisible"
      :initial-data="editingData"
      @submit="onModalSubmit"
    />
  </div>
</template>

<script setup lang="ts">
import {
  addChannel,
  deleteChannel,
  editChannel,
  getChannelList,
  testChannelSend,
  toggleChannelEnable,
  type ChannelConfig,
} from '@/claw/api/channel'
import ChannelEditModal from '@/claw/views/Config/Channel/ChannelEditModal.vue'
import LoadingState from '@/components/LoadingState.vue'
import { message } from 'ant-design-vue'
import Edit from '~icons/lucide/edit'
import Key from '~icons/lucide/key'
import MessageSquare from '~icons/lucide/message-square'
import Plus from '~icons/lucide/plus'
import RefreshCw from '~icons/lucide/refresh-cw'
import Send from '~icons/lucide/send'
import Trash2 from '~icons/lucide/trash-2'
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { testActionSet, testActionUnset } from '@/utils/test'

const { t } = useI18n()

const loading = ref(false)
const channels = ref<ChannelConfig[]>([])
const modalVisible = ref(false)
const editingData = ref<ChannelConfig | null>(null)
const togglingId = ref<number | null>(null)
const testingId = ref<number | null>(null)

const columns = computed(() => [
  {
    title: t('config.channelColName'),
    dataIndex: 'title',
    key: 'title',
    width: 160,
  },
  {
    title: t('config.channelColType'),
    dataIndex: 'type',
    key: 'type',
    width: 100,
  },
  { title: t('config.channelColConfig'), key: 'config' },
  { title: t('config.channelColStatus'), key: 'status', width: 110 },
  { title: t('config.channelColIsGlobal'), key: 'isGlobal', width: 80 },
  { title: t('config.channelColEnable'), key: 'enable', width: 80 },
  { title: t('config.channelColActions'), key: 'actions', width: 280 },
])

function maskToken(token: string): string {
  if (token.length <= 8) return '****'
  return token.slice(0, 6) + '****' + token.slice(-4)
}

function typeLabel(type: string): string {
  const map: Record<string, string> = {
    telegram: 'Telegram',
    feishu: t('config.channelTypeFeishu'),
    dingtalk: t('config.channelTypeDingtalk'),
    wecom: t('config.channelTypeWecom'),
    discord: 'Discord',
    slack: 'Slack',
    msteams: 'MS Teams',
    line: 'LINE',
    matrix: 'Matrix',
    mattermost: 'Mattermost',
  }
  return map[type] ?? type
}

function typeColor(type: string): string {
  const map: Record<string, string> = {
    telegram: 'blue',
    feishu: 'green',
    dingtalk: 'orange',
    wecom: 'cyan',
    discord: 'purple',
    slack: 'magenta',
    msteams: 'geekblue',
    line: 'lime',
    matrix: 'volcano',
    mattermost: 'gold',
  }
  return map[type] ?? 'default'
}

function openAdd() {
  editingData.value = null
  modalVisible.value = true
}

function openEdit(record: ChannelConfig) {
  editingData.value = { ...record }
  modalVisible.value = true
}

async function onModalSubmit(entry: ChannelConfig) {
  try {
    if (entry.id) {
      await editChannel(entry)
    } else {
      await addChannel(entry)
    }
    message.success(t('config.channelSaveSuccess'))
    await loadList()
  } catch {
    message.error(t('config.channelSaveFailed'))
  }
}

async function doDelete(id: number) {
  try {
    await deleteChannel(id)
    channels.value = channels.value.filter((b) => b.id !== id)
    message.success(t('config.channelDeleteSuccess'))
  } catch {
    message.error(t('config.channelDeleteFailed'))
  }
}

async function doTestSend(record: ChannelConfig) {
  if (!record.id) return
  if (record.type === 'telegram' && !record.config?.chatId) {
    message.warning(t('config.channelTestNoChatIdWarning'))
    return
  }
  if (['feishu', 'dingtalk'].includes(record.type) && !record.config?.chatId) {
    message.warning(t('config.channelTestNoChatIdGroupWarning'))
    return
  }
  if (record.type === 'wecom' && !record.config?.toUser) {
    message.warning(t('config.channelTestNoToUserWarning'))
    return
  }
  if (
    ['discord', 'slack', 'mattermost'].includes(record.type) &&
    !record.config?.channelId
  ) {
    message.warning(t('config.channelTestNoChannelIdWarning'))
    return
  }
  if (record.type === 'msteams' && !record.config?.conversationId) {
    message.warning(t('config.channelTestNoConversationIdWarning'))
    return
  }
  if (record.type === 'line' && !record.config?.userId) {
    message.warning(t('config.channelTestNoUserIdWarning'))
    return
  }
  if (record.type === 'matrix' && !record.config?.roomId) {
    message.warning(t('config.channelTestNoRoomIdWarning'))
    return
  }
  testingId.value = record.id
  try {
    await testChannelSend(record.id)
    message.success(t('config.channelTestSendSuccess'))
  } catch {
    message.error(t('config.channelTestSendFailed'))
  } finally {
    testingId.value = null
  }
}

async function toggleEnable(record: ChannelConfig, enable: boolean) {
  if (!record.id) return
  togglingId.value = record.id
  try {
    await toggleChannelEnable(record.id, enable)
    record.enable = enable
    message.success(
      enable
        ? t('config.channelEnableSuccess')
        : t('config.channelDisableSuccess')
    )
  } catch {
    message.error(t('config.channelToggleFailed'))
  } finally {
    togglingId.value = null
  }
}

async function loadList() {
  loading.value = true
  try {
    channels.value = await getChannelList()
  } catch {
    message.error(t('config.channelLoadFailed'))
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  testActionSet('config.channel.add', () => openAdd())
  testActionSet('list.refresh', () => loadList())
})
onUnmounted(() => {
  testActionUnset('config.channel.add')
  testActionUnset('list.refresh')
})

onMounted(loadList)
</script>
