<script setup lang="ts">
import { onMounted, ref } from 'vue'
import DatetimeViewer from '@/components/DatetimeViewer.vue'
import EmptyState from '@/components/EmptyState.vue'
import ListerTop from '@/components/ListerTop.vue'
import {
  type UserRecord,
  addUser,
  deleteUser,
  editUser,
  getUserList,
} from '@/api/user.ts'
import { Plus, Edit, Trash2 } from 'lucide-vue-next'
import { message } from 'ant-design-vue'
import { useI18n } from 'vue-i18n'
import UserEditModal from './User/UserEditModal.vue'

const { t } = useI18n()

const loading = ref(false)
const records = ref<UserRecord[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(20)
const modalVisible = ref(false)
const editingUser = ref<UserRecord | null>(null)

const columns = [
  { title: 'Tenant ID', key: 'tenantId', width: 100, align: 'center' },
  { title: t('config.userUsername'), key: 'username', width: 160 },
  { title: t('config.userApiToken'), key: 'apiToken', ellipsis: true },
  {
    title: t('config.userIsCreator'),
    key: 'isCreator',
    width: 100,
    align: 'center',
  },
  { title: t('common.createdAt'), key: 'createdAt', width: 180 },
  { title: t('common.actions'), key: 'actions', width: 140 },
] as const

async function load() {
  loading.value = true
  try {
    const result = await getUserList(page.value, pageSize.value)
    records.value = result.records
    total.value = result.total
  } catch (e: any) {
    message.error(e.message || t('config.loadFailed'))
  } finally {
    loading.value = false
  }
}

function openAdd() {
  editingUser.value = null
  modalVisible.value = true
}

function openEdit(record: UserRecord) {
  editingUser.value = record
  modalVisible.value = true
}

async function handleDelete(record: UserRecord) {
  try {
    await deleteUser(record.id)
    message.success(t('config.userDeleteSuccess'))
    await load()
  } catch (e: any) {
    message.error(e.message || t('config.channelDeleteFailed'))
  }
}

async function onModalSubmit(data: {
  username: string
  password: string
  isCreator: boolean
}) {
  try {
    if (editingUser.value) {
      const updateData: any = {
        id: editingUser.value.id,
        username: data.username,
        isCreator: data.isCreator,
      }
      if (data.password) updateData.password = data.password
      await editUser(updateData)
      message.success(t('config.userEditSuccess'))
    } else {
      await addUser({ ...data, tenantId: 1 })
      message.success(t('config.userAddSuccess'))
    }
    modalVisible.value = false
    await load()
  } catch (e: any) {
    message.error(e.message || t('config.saveFailed'))
    throw e
  }
}

onMounted(load)
</script>

<template>
  <div>
    <ListerTop
      :count="total"
      :count-label="t('config.userCount', { count: total })"
    >
      <template #actions>
        <a-button type="primary" @click="openAdd">
          <div class="inline-flex items-center gap-1">
            <Plus class="w-4 h-4" aria-hidden="true" />{{ t('config.userAdd') }}
          </div>
        </a-button>
      </template>
    </ListerTop>

    <!-- Empty state -->
    <EmptyState
      v-if="!loading && records.length === 0"
      :description="t('config.userEmpty')"
    >
      <a-button type="primary" @click="openAdd">
        <div class="inline-flex items-center gap-1">
          <Plus class="w-4 h-4" aria-hidden="true" />{{ t('config.userAdd') }}
        </div>
      </a-button>
    </EmptyState>

    <!-- Table -->
    <a-table
      v-else
      :data-source="records"
      :columns="columns"
      :loading="loading"
      :pagination="{
        current: page,
        pageSize,
        total,
        showSizeChanger: true,
        pageSizeOptions: ['10', '20', '50'],
        onChange: (p: number, ps: number) => {
          page = p
          pageSize = ps
          load()
        },
      }"
      row-key="id"
      :scroll="{ x: 'max-content' }"
    >
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'isCreator'">
          <a-tag v-if="record.isCreator" color="arcoblue">{{
            t('config.userIsCreator')
          }}</a-tag>
          <span v-else class="text-gray-400">—</span>
        </template>

        <template v-else-if="column.key === 'createdAt'">
          <DatetimeViewer :value="record.createdAt" />
        </template>

        <template v-else-if="column.key === 'apiToken'">
          <span
            v-if="record.apiToken"
            class="font-mono text-xs text-gray-500 dark:text-gray-400"
          >
            {{ record.apiToken.slice(0, 16) }}…
          </span>
          <span v-else class="text-gray-400 text-xs">{{
            t('config.userApiTokenNone')
          }}</span>
        </template>

        <template v-else-if="column.key === 'actions'">
          <div class="flex gap-2">
            <a-button @click="openEdit(record)">
              <div class="inline-flex items-center gap-1">
                <Edit class="w-4 h-4" aria-hidden="true" />{{
                  t('config.userEdit')
                }}
              </div>
            </a-button>
            <a-popconfirm
              :title="
                record.isCreator
                  ? t('config.userCannotDeleteCreator')
                  : t('config.userDeleteConfirm')
              "
              @confirm="handleDelete(record)"
            >
              <a-button danger :disabled="record.isCreator">
                <div class="inline-flex items-center gap-1">
                  <Trash2 class="w-4 h-4" aria-hidden="true" />{{
                    t('config.userDelete')
                  }}
                </div>
              </a-button>
            </a-popconfirm>
          </div>
        </template>
      </template>
    </a-table>

    <UserEditModal
      v-model:open="modalVisible"
      :initial-data="editingUser"
      @submit="onModalSubmit"
    />
  </div>
</template>
