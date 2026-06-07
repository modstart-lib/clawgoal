<template>
  <a-modal
    :keyboard="false"
    :mask-closable="false"
    :open="open"
    :title="project ? t('claw.project.editTitle') : t('claw.project.addTitle')"
    width="min(600px, 90vw)"
    :confirm-loading="saving"
    @cancel="$emit('update:open', false)"
    @ok="handleSave"
  >
    <div class="py-2 space-y-4">
      <div>
        <label
          class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5"
        >
          {{ t('claw.project.nameLabel') }} <span class="text-red-500">*</span>
        </label>
        <a-input
          v-model:value="form.title"
          :placeholder="t('claw.project.namePlaceholder')"
          class="!rounded-xl"
        />
      </div>

      <div>
        <label
          class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5"
          >{{ t('claw.project.descLabel') }}</label
        >
        <a-textarea
          v-model:value="form.description"
          :placeholder="t('claw.project.descPlaceholder')"
          :auto-size="{ minRows: 2, maxRows: 5 }"
          class="!rounded-xl"
        />
      </div>

      <div>
        <label
          class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5"
          >{{ t('claw.project.statusLabel') }}</label
        >
        <a-select v-model:value="form.status" class="!w-full">
          <a-select-option value="planning">{{
            t('claw.project.statusPlanning')
          }}</a-select-option>
          <a-select-option value="active">{{
            t('claw.project.statusActive')
          }}</a-select-option>
          <a-select-option value="paused">{{
            t('claw.project.statusPaused')
          }}</a-select-option>
          <a-select-option value="done">{{
            t('claw.project.statusDone')
          }}</a-select-option>
        </a-select>
      </div>

      <div class="grid grid-cols-2 gap-4">
        <div>
          <label
            class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5"
            >{{ t('claw.project.startLabel') }}</label
          >
          <a-date-picker
            v-model:value="form.startAt"
            class="!w-full !rounded-xl"
            :placeholder="t('claw.project.startPlaceholder')"
            format="YYYY-MM-DD"
          />
        </div>
        <div>
          <label
            class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5"
            >{{ t('claw.project.dueLabel') }}</label
          >
          <a-date-picker
            v-model:value="form.dueAt"
            class="!w-full !rounded-xl"
            :placeholder="t('claw.project.duePlaceholder')"
            format="YYYY-MM-DD"
          />
        </div>
      </div>

      <!-- 颜色选择 -->
      <div>
        <label
          class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
          >{{ t('claw.project.colorLabel') }}</label
        >
        <ColorSelector
          v-model="form.color"
          shape="square"
          :show-custom="true"
        />
      </div>

      <!-- Logo -->
      <div>
        <label
          class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5"
          >{{ t('claw.project.logoLabel') }}</label
        >
        <ImageCoverSelector v-model="form.logo" build-in-type="cover" />
      </div>
    </div>
  </a-modal>
</template>

<script setup lang="ts">
import { addProject, editProject, type ProjectItem } from '@/claw/api/project'
import ColorSelector from '@/components/ColorSelector.vue'
import ImageCoverSelector from '@/components/ImageCoverSelector.vue'
import { message } from 'ant-design-vue'
import dayjs from 'dayjs'
import { onMounted, onUnmounted, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { testActionSet, testActionUnset } from '@/utils/test'

const { t } = useI18n()

const props = defineProps<{
  open: boolean
  project?: ProjectItem | null
}>()

const emit = defineEmits<{
  (e: 'update:open', v: boolean): void
  (e: 'refresh'): void
}>()

const defaultForm = () => ({
  title: '',
  description: '',
  status: 'planning' as string,
  color: '#6366f1',
  logo: '',
  startAt: null as any,
  dueAt: null as any,
})

const form = reactive(defaultForm())
const saving = ref(false)

watch(
  () => props.open,
  (v) => {
    if (v) {
      if (props.project) {
        Object.assign(form, {
          title: props.project.title,
          description: props.project.description || '',
          status: props.project.status,
          color: props.project.color || '#6366f1',
          logo: props.project.logo || '',
          startAt: props.project.startAt ? dayjs(props.project.startAt) : null,
          dueAt: props.project.dueAt ? dayjs(props.project.dueAt) : null,
        })
      } else {
        Object.assign(form, defaultForm())
      }
    }
  }
)

const handleSave = async () => {
  if (!form.title.trim()) {
    message.warning(t('claw.project.nameRequired'))
    return
  }
  saving.value = true
  try {
    const payload = {
      title: form.title.trim(),
      description: form.description || undefined,
      status: form.status as any,
      color: form.color,
      logo: form.logo || undefined,
      startAt: form.startAt
        ? dayjs(form.startAt).format('YYYY-MM-DD')
        : undefined,
      dueAt: form.dueAt ? dayjs(form.dueAt).format('YYYY-MM-DD') : undefined,
    }
    if (props.project) {
      await editProject(props.project.id, payload)
      message.success(t('claw.project.saveSuccess'))
    } else {
      await addProject(payload)
      message.success(t('claw.project.addSuccess'))
    }
    emit('refresh')
    emit('update:open', false)
  } catch (e: any) {
    message.error(
      e.message ||
        (props.project
          ? t('claw.project.updateFailed')
          : t('claw.project.saveFailed'))
    )
  } finally {
    saving.value = false
  }
}

onMounted(() => {
  testActionSet('clawProject.add.fill', () => {
    form.title = `测试项目_${Date.now()}`
  })
  testActionSet('clawProject.add.submit', () => handleSave())
})
onUnmounted(() => {
  testActionUnset('clawProject.add.fill')
  testActionUnset('clawProject.add.submit')
})
</script>
