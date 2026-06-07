<template>
  <div class="space-y-3">
    <!-- 上传自定义图片（大尺寸预览） -->
    <div class="flex items-stretch h-24">
      <a-upload
        :show-upload-list="false"
        :before-upload="handleBeforeUpload"
        :custom-request="handleUpload"
        accept="image/*"
      >
        <!-- 有值时：显示图片预览，hover 显示加号遮罩 -->
        <div
          v-if="modelValue"
          class="group w-20 h-20 rounded-xl overflow-hidden cursor-pointer relative border-2 transition-all"
          :class="[
            uploading ? 'opacity-60 pointer-events-none' : '',
            isBuiltIn(modelValue) ? 'border-transparent' : 'border-primary',
          ]"
        >
          <img :src="modelValue" class="w-full h-full object-cover" />
          <div
            class="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <Loader2
              v-if="uploading"
              class="w-4 h-4 animate-spin text-white"
              aria-hidden="true"
            />
            <Plus v-else class="w-5 h-5 text-white" />
          </div>
        </div>
        <!-- 无值时：虚线边框 + 加号 -->
        <div
          v-else
          class="w-20 h-20 rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-600 flex items-center justify-center cursor-pointer hover:border-primary hover:bg-primary/5 dark:hover:bg-primary/20 transition-all bg-gray-50/50 dark:bg-gray-800/40 backdrop-blur-sm hover:shadow-md"
          :class="uploading ? 'opacity-60 pointer-events-none' : ''"
        >
          <Loader2
            v-if="uploading"
            class="w-4 h-4 animate-spin text-gray-400"
            aria-hidden="true"
          />
          <Plus v-else class="w-6 h-6 text-gray-400" />
        </div>
      </a-upload>
      <div v-if="$slots.aside" class="flex-1 ml-3">
        <slot name="aside" />
      </div>
    </div>

    <!-- 内置图片网格：前19张 + 最后一格随机按钮 -->
    <div class="grid grid-cols-5 md:grid-cols-10 gap-1">
      <div
        v-for="img in allBuiltInImages.slice(0, 19)"
        :key="img.id"
        :title="img.name"
        class="w-10 h-10 rounded-lg overflow-hidden cursor-pointer border-2 transition-all hover:scale-110 hover:shadow-md"
        :class="
          modelValue === img.url
            ? 'border-primary ring-2 ring-primary/30 scale-110 shadow-md relative z-10'
            : 'border-white/50 dark:border-gray-700/50 hover:border-gray-300 dark:hover:border-gray-500 opacity-90 hover:opacity-100'
        "
        @click="$emit('update:modelValue', img.url)"
      >
        <img
          :src="img.url"
          :alt="img.name"
          class="w-full h-full object-cover"
        />
      </div>

      <!-- 第20格：随机按钮 -->
      <a-tooltip
        :title="
          props.buildInType === 'cover'
            ? t('imageCover.randomCoverTooltip')
            : t('imageCover.randomAvatarTooltip')
        "
      >
        <div
          class="w-10 h-10 rounded-lg border-2 border-dashed border-gray-300/80 dark:border-gray-600/80 flex items-center justify-center cursor-pointer hover:border-primary hover:bg-primary/5 dark:hover:bg-primary/20 transition-all bg-gray-50/40 dark:bg-gray-800/40 backdrop-blur-sm hover:shadow-md hover:scale-110 relative z-10"
          @click="fetchRandomAvatar"
        >
          <Shuffle
            class="w-4 h-4 text-gray-500 dark:text-gray-400 hover:text-primary transition-colors"
          />
        </div>
      </a-tooltip>
    </div>
  </div>
</template>

<script setup lang="ts">
import { message } from 'ant-design-vue'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import Loader2 from '~icons/lucide/loader-2'
import Plus from '~icons/lucide/plus'
import Shuffle from '~icons/lucide/shuffle'
import { randomAvatar, randomCover } from '../api/mock'
import { uploadImage } from '../api/upload'
import { AVATARS_SVG_URL } from './images/avatar'
import { COVERS_SVG_URL } from './images/cover'

const { t } = useI18n()

export interface CoverImage {
  id: string
  name: string
  url: string
}

type BuildInType = 'cover' | 'avatar'

const props = defineProps<{
  modelValue?: string
  buildInType?: BuildInType
  buildInImages?: CoverImage[]
  randomBuildIn?: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

// 根据 buildInType 决定默认内置图池，buildInImages 外部图前置
const allBuiltInImages = computed<CoverImage[]>(() => {
  const external = props.buildInImages ?? []
  const pool = props.buildInType === 'avatar' ? AVATARS_SVG_URL : COVERS_SVG_URL
  return [...external, ...pool]
})

const isBuiltIn = (url: string) =>
  allBuiltInImages.value.some((img) => img.url === url)

// randomBuildIn：值为空时自动随机选一张内置图片
watch(
  () => props.modelValue,
  (val) => {
    if (props.randomBuildIn && !val && allBuiltInImages.value.length > 0) {
      const idx = Math.floor(Math.random() * allBuiltInImages.value.length)
      emit('update:modelValue', allBuiltInImages.value[idx].url)
    }
  },
  { immediate: true }
)

const fetchRandomAvatar = async () => {
  uploading.value = true
  try {
    const seed = Math.random().toString(36).slice(2, 10)
    if (props.buildInType === 'avatar') {
      emit('update:modelValue', await randomAvatar(seed))
    } else {
      emit('update:modelValue', await randomCover(seed))
    }
  } catch {
    message.error(t('imageCover.fetchRandomFailed'))
  } finally {
    uploading.value = false
  }
}

// 上传逻辑
const uploading = ref(false)

const handleBeforeUpload = (file: File) => {
  if (!file.type.startsWith('image/')) {
    message.error(t('imageCover.onlyImages'))
    return false
  }
  if (file.size / 1024 / 1024 > 10) {
    message.error(t('imageCover.imageSizeLimit'))
    return false
  }
  return true
}

const handleUpload = async (options: any) => {
  uploading.value = true
  try {
    const result = await uploadImage(options.file)
    emit('update:modelValue', result.url)
  } catch {
    message.error(t('imageCover.uploadFailed'))
  } finally {
    uploading.value = false
  }
}
</script>
