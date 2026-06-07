<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

const props = defineProps<{ value: string }>()
const emit = defineEmits<{ 'update:value': [val: string] }>()
const { t } = useI18n()

type MainMode = 'common' | 'custom'
type Unit = 'day' | 'hour' | 'minute'

const PRESET_VALUES = [
  '*/30 * * * *',
  '0 * * * *',
  '0 0 * * *',
  '0 6 * * *',
  '0 9 * * *',
  '0 12 * * *',
  '0 18 * * *',
  '0 22 * * *',
  '0 9 * * 1',
  '0 9 * * 6',
  '0 9 1 * *',
]

const commonPresets = computed(() =>
  PRESET_VALUES.map((value, i) => ({ label: t(`cronInput.preset${i}`), value }))
)

const extraPresets = ref<{ label: string; value: string }[]>([])

const allPresets = computed(() => [
  ...commonPresets.value,
  ...extraPresets.value,
])

const state = reactive({
  mode: 'common' as MainMode,
  preset: '0 9 * * *',
  interval: 1,
  unit: 'day' as Unit,
  atHour: 9,
  atMinute: 0,
})

// 顶部文本输入框的值（用于防止输入时跳动）
const inputValue = ref('')
let _skipInputSync = false

const computedCron = computed<string>(() => {
  if (state.mode === 'common') return state.preset
  switch (state.unit) {
    case 'minute':
      return `*/${state.interval} * * * *`
    case 'hour':
      return `${state.atMinute} */${state.interval} * * *`
    case 'day':
      return `${state.atMinute} ${state.atHour} */${state.interval} * *`
    default:
      return ''
  }
})

function parseCron(cron: string) {
  if (!cron) return
  const trimmed = cron.trim()
  const parts = trimmed.split(/\s+/)
  if (parts.length !== 5) return
  const [min, hour, dom, , dow] = parts

  // 匹配常见预设
  if (PRESET_VALUES.includes(trimmed)) {
    state.mode = 'common'
    state.preset = trimmed
    return
  }

  // 每 N 分钟：*/N * * * *
  if (/^\*\/\d+$/.test(min) && hour === '*' && dom === '*' && dow === '*') {
    state.mode = 'custom'
    state.unit = 'minute'
    state.interval = parseInt(min.split('/')[1]) || 1
    return
  }

  // 每 N 小时 M 分：M */N * * *
  if (
    /^\*\/\d+$/.test(hour) &&
    dom === '*' &&
    dow === '*' &&
    /^\d+$/.test(min)
  ) {
    state.mode = 'custom'
    state.unit = 'hour'
    state.interval = parseInt(hour.split('/')[1]) || 1
    state.atMinute = parseInt(min) || 0
    return
  }

  // 每 N 天 H:M：M H */N * *
  if (
    /^\*\/\d+$/.test(dom) &&
    dow === '*' &&
    /^\d+$/.test(hour) &&
    /^\d+$/.test(min)
  ) {
    state.mode = 'custom'
    state.unit = 'day'
    state.interval = parseInt(dom.split('/')[1]) || 1
    state.atHour = parseInt(hour) || 0
    state.atMinute = parseInt(min) || 0
    return
  }

  // 无法识别，切到常见模式并保留原始 cron
  state.mode = 'common'
  state.preset = trimmed
  // 若不在预设列表中，动态加一条（避免 select 显示空白）
  if (
    !PRESET_VALUES.includes(trimmed) &&
    !extraPresets.value.find((p) => p.value === trimmed)
  ) {
    extraPresets.value.push({ label: trimmed, value: trimmed })
  }
}

watch(computedCron, (val) => {
  if (val !== props.value) emit('update:value', val)
  _skipInputSync = true
  inputValue.value = val
  _skipInputSync = false
})

watch(
  () => props.value,
  (val) => {
    if (val !== computedCron.value) parseCron(val)
    inputValue.value = val ?? ''
  },
  { immediate: true }
)

function onInputBlur() {
  if (_skipInputSync) return
  const v = inputValue.value.trim()
  if (v && v !== computedCron.value) {
    parseCron(v)
    emit('update:value', v)
  }
}

function onModeChange() {
  // 切换为常见时恢复默认预设
  if (state.mode === 'common' && !PRESET_VALUES.includes(state.preset)) {
    state.preset = '0 9 * * *'
  }
}
</script>

<template>
  <div class="space-y-1">
    <!-- 第一行：Cron 表达式文本输入 -->
    <div>
      <a-input
        v-model:value="inputValue"
        :placeholder="t('cronInput.placeholder')"
        class="font-mono"
        @blur="onInputBlur"
      />
    </div>

    <!-- 第二行：模式选择 + 对应控件（水平排列） -->
    <a-form-item-rest>
      <div
        class="flex items-center gap-2 flex-wrap p-2 bg-gray-50/50 dark:bg-neutral-900/50 rounded-lg border border-gray-200 dark:border-neutral-800 mt-2"
      >
        <!-- 模式下拉 -->
        <a-select
          v-model:value="state.mode"
          style="width: 88px"
          @change="onModeChange"
        >
          <a-select-option value="common">{{
            t('cronInput.modeBuiltin')
          }}</a-select-option>
          <a-select-option value="custom">{{
            t('cronInput.modeCustom')
          }}</a-select-option>
        </a-select>

        <!-- 常见：预设列表下拉 -->
        <template v-if="state.mode === 'common'">
          <a-select v-model:value="state.preset" style="flex: 1; width: 160px">
            <a-select-option
              v-for="p in allPresets"
              :key="p.value"
              :value="p.value"
            >
              {{ p.label }}
            </a-select-option>
          </a-select>
        </template>

        <!-- 自定义：每 N [天|小时|分钟] [H时] [M分] -->
        <template v-else>
          <span class="text-sm text-gray-500 dark:text-gray-400 shrink-0">{{
            t('cronInput.everyPrefix')
          }}</span>
          <a-input-number
            v-model:value="state.interval"
            :min="1"
            :max="999"
            :controls="false"
            style="width: 56px"
          />
          <a-select v-model:value="state.unit" style="width: 76px">
            <a-select-option value="day">{{
              t('cronInput.unitDay')
            }}</a-select-option>
            <a-select-option value="hour">{{
              t('cronInput.unitHour')
            }}</a-select-option>
            <a-select-option value="minute">{{
              t('cronInput.unitMinute')
            }}</a-select-option>
          </a-select>

          <template v-if="state.unit === 'day'">
            <a-input-number
              v-model:value="state.atHour"
              :min="0"
              :max="23"
              :controls="false"
              style="width: 52px"
            />
            <span class="text-sm text-gray-500 dark:text-gray-400 shrink-0">{{
              t('cronInput.hourSuffix')
            }}</span>
            <a-input-number
              v-model:value="state.atMinute"
              :min="0"
              :max="59"
              :controls="false"
              style="width: 52px"
            />
            <span class="text-sm text-gray-500 dark:text-gray-400 shrink-0">{{
              t('cronInput.minuteSuffix')
            }}</span>
          </template>

          <template v-else-if="state.unit === 'hour'">
            <a-input-number
              v-model:value="state.atMinute"
              :min="0"
              :max="59"
              :controls="false"
              style="width: 52px"
            />
            <span class="text-sm text-gray-500 dark:text-gray-400 shrink-0">{{
              t('cronInput.minuteSuffix')
            }}</span>
          </template>
        </template>
      </div>
    </a-form-item-rest>
  </div>
</template>
