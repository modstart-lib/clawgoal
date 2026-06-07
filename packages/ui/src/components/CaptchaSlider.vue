<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from 'vue'
import Check from '~icons/lucide/check'
import RefreshCcw from '~icons/lucide/refresh-ccw'
import ShieldCheck from '~icons/lucide/shield-check'
import X from '~icons/lucide/x'
import { captchaApi } from '../api/captcha'

const emit = defineEmits<{
  verified: [verifiedToken: string]
}>()

const IMG_W = 300
const PIECE_W = 42
const MAX_X = IMG_W - PIECE_W

// 弹窗状态
const modalOpen = ref(false)
const verified = ref(false)

// 滑块状态
const bgImg = ref('')
const pieceImg = ref('')
const token = ref('')
const loading = ref(false)
const sliderX = ref(0)
const dragging = ref(false)
const dragStartClientX = ref(0)
const sliderStartX = ref(0)
const status = ref<'idle' | 'verifying' | 'success' | 'fail'>('idle')
const countdown = ref(0)
let countdownTimer: ReturnType<typeof setInterval> | null = null

function clearCountdown() {
  if (countdownTimer) {
    clearInterval(countdownTimer)
    countdownTimer = null
  }
  countdown.value = 0
}

function startCountdown() {
  clearCountdown()
  countdown.value = 3
  countdownTimer = setInterval(() => {
    countdown.value--
    if (countdown.value <= 0) {
      clearCountdown()
    }
  }, 1000)
}

function reset() {
  clearCountdown()
  modalOpen.value = false
  verified.value = false
  token.value = ''
  status.value = 'idle'
  sliderX.value = 0
  bgImg.value = ''
  pieceImg.value = ''
  emit('verified', '')
}

function openModal() {
  if (verified.value) return
  modalOpen.value = true
}

// 防止弹窗关闭后焦点回到触发元素时重新弹出
const skipFocusOpen = ref(false)

function onTriggerFocus() {
  if (skipFocusOpen.value || verified.value) return
  openModal()
}

watch(modalOpen, (val) => {
  if (val) {
    load()
  } else {
    // 弹窗关闭时，短暂禁止 focus 触发，避免焦点回归时重复弹出
    skipFocusOpen.value = true
    setTimeout(() => {
      skipFocusOpen.value = false
    }, 200)
  }
})

async function load() {
  loading.value = true
  clearCountdown()
  status.value = 'idle'
  sliderX.value = 0
  bgImg.value = ''
  pieceImg.value = ''
  try {
    const data = await captchaApi.generate()
    bgImg.value = data.bgImg
    pieceImg.value = data.pieceImg
    token.value = data.token
  } finally {
    loading.value = false
  }
}

function startDrag(e: MouseEvent | TouchEvent) {
  if (status.value === 'success' || status.value === 'verifying') return
  dragging.value = true
  const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX
  dragStartClientX.value = clientX
  sliderStartX.value = sliderX.value
}

function onMouseMove(e: MouseEvent) {
  if (!dragging.value) return
  const dx = e.clientX - dragStartClientX.value
  sliderX.value = Math.max(0, Math.min(MAX_X, sliderStartX.value + dx))
}

function onTouchMove(e: TouchEvent) {
  if (!dragging.value) return
  e.preventDefault()
  const dx = e.touches[0].clientX - dragStartClientX.value
  sliderX.value = Math.max(0, Math.min(MAX_X, sliderStartX.value + dx))
}

function onDragEnd() {
  if (!dragging.value) return
  dragging.value = false
  if (sliderX.value > 0 && status.value === 'idle') {
    verify()
  }
}

async function verify() {
  status.value = 'verifying'
  try {
    const data = await captchaApi.verify(token.value, sliderX.value)
    status.value = 'success'
    verified.value = true
    emit('verified', data.verifiedToken)
    modalOpen.value = false
  } catch {
    status.value = 'fail'
    startCountdown()
    setTimeout(() => {
      load()
    }, 3000)
  }
}

onMounted(() => {
  document.addEventListener('mousemove', onMouseMove)
  document.addEventListener('mouseup', onDragEnd)
  document.addEventListener('touchmove', onTouchMove, { passive: false })
  document.addEventListener('touchend', onDragEnd)
})

onUnmounted(() => {
  clearCountdown()
  document.removeEventListener('mousemove', onMouseMove)
  document.removeEventListener('mouseup', onDragEnd)
  document.removeEventListener('touchmove', onTouchMove)
  document.removeEventListener('touchend', onDragEnd)
})

defineExpose({
  reset,
})
</script>

<template>
  <!-- 触发按钮 -->
  <div class="select-none">
    <div
      v-if="!verified"
      class="flex items-center justify-between h-10 px-4 rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 cursor-pointer hover:border-primary dark:hover:border-primary transition-colors"
      tabindex="0"
      @click="openModal"
      @focus="onTriggerFocus"
      @keydown.enter.prevent="openModal"
    >
      <span class="text-gray-400 dark:text-gray-500 text-sm">{{
        $t('captchaSlider.clickToVerify')
      }}</span>
      <ShieldCheck class="w-4 h-4 text-gray-400 dark:text-gray-500" />
    </div>
    <div
      v-else
      class="flex items-center gap-2 h-10 px-4 rounded-lg border border-green-500 bg-green-50 dark:bg-green-900/20"
    >
      <Check class="w-4 h-4 text-green-500" />
      <span class="text-green-600 dark:text-green-400 text-sm">{{
        $t('captchaSlider.verified')
      }}</span>
    </div>
  </div>

  <!-- 验证弹窗 -->
  <a-modal
    v-model:open="modalOpen"
    :keyboard="false"
    :mask-closable="false"
    :footer="null"
    :title="$t('captchaSlider.modalTitle')"
    :width="360"
  >
    <div class="flex flex-col items-center py-2 select-none">
      <!-- 背景图区域 -->
      <div
        class="relative overflow-hidden rounded border border-gray-200 dark:border-gray-600 bg-gray-100 dark:bg-gray-700"
        :style="{ width: `${IMG_W}px`, height: '150px' }"
      >
        <div
          v-if="loading"
          class="absolute inset-0 flex items-center justify-center"
        >
          <span class="text-gray-400 text-sm">{{
            $t('captchaSlider.loading')
          }}</span>
        </div>
        <template v-else>
          <img
            v-if="bgImg"
            :src="bgImg"
            class="absolute inset-0 w-full h-full object-fill"
            draggable="false"
          />
          <img
            v-if="pieceImg"
            :src="pieceImg"
            class="absolute top-0 object-fill"
            :style="{
              left: `${sliderX}px`,
              width: `${PIECE_W}px`,
              height: '150px',
            }"
            draggable="false"
          />
        </template>
        <div
          v-if="status === 'success'"
          class="absolute inset-0 flex items-center justify-center bg-green-500/20 rounded"
        >
          <Check class="w-8 h-8 text-green-500" />
        </div>
      </div>

      <!-- 滑动轨道 -->
      <div
        class="relative mt-2 overflow-hidden rounded border border-gray-200 dark:border-gray-600"
        :style="{ width: `${IMG_W}px`, height: '40px' }"
        :class="
          status === 'success'
            ? 'bg-green-50 dark:bg-green-900/20'
            : status === 'fail'
              ? 'bg-red-50 dark:bg-red-900/20'
              : 'bg-gray-100 dark:bg-gray-700'
        "
      >
        <!-- 填充条 -->
        <div
          class="absolute top-0 left-0 h-full rounded transition-colors"
          :class="
            status === 'success'
              ? 'bg-green-200/60'
              : status === 'fail'
                ? 'bg-red-200/60'
                : 'bg-primary/20'
          "
          :style="{ width: `${sliderX + PIECE_W}px` }"
        />
        <!-- 提示文字 -->
        <div
          v-if="sliderX === 0 && status === 'idle'"
          class="absolute inset-0 flex items-center justify-center pointer-events-none"
        >
          <span class="text-gray-400 dark:text-gray-500 text-sm">{{
            $t('captchaSlider.slideToVerify')
          }}</span>
        </div>
        <!-- 滑块 -->
        <div
          class="absolute top-0 h-full flex items-center justify-center rounded"
          :class="[
            status === 'success'
              ? 'bg-green-500 cursor-default'
              : status === 'fail'
                ? 'bg-red-500 cursor-pointer'
                : 'bg-primary cursor-grab active:cursor-grabbing',
            status === 'verifying' ? 'opacity-60' : '',
          ]"
          :style="{ left: `${sliderX}px`, width: `${PIECE_W}px` }"
          @mousedown.prevent="startDrag"
          @touchstart.prevent="startDrag"
        >
          <Check v-if="status === 'success'" class="w-5 h-5 text-white" />
          <X v-else-if="status === 'fail'" class="w-5 h-5 text-white" />
          <span v-else class="text-white text-xl leading-none font-bold"
            >›</span
          >
        </div>
      </div>

      <!-- 失败提示 -->
      <div
        v-if="status === 'fail'"
        :style="{ width: `${IMG_W}px` }"
        class="mt-1 flex items-center gap-1 text-sm text-red-500"
      >
        <span>{{
          countdown > 0
            ? $t('captchaSlider.failMessage', { countdown })
            : $t('captchaSlider.refreshing')
        }}</span>
        <a
          class="ml-1 cursor-pointer inline-flex items-center gap-1 text-red-500 hover:text-red-700"
          @click="load"
        >
          <RefreshCcw class="w-3 h-3" />
          {{ $t('captchaSlider.refreshNow') }}
        </a>
      </div>
    </div>
  </a-modal>
</template>
