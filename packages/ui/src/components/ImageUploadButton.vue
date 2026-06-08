<template>
  <a-upload
    :show-upload-list="false"
    :before-upload="handleBeforeUpload"
    :custom-request="handleUpload"
    :multiple="multiple"
    accept="image/*"
  >
    <a-button
      :type="type"
      :loading="uploading"
      class="shadow-sm backdrop-blur-sm bg-white/80 dark:bg-gray-800/80 hover:bg-primary-50 dark:hover:bg-primary-900/30 transition-all !text-primary-600 dark:!text-primary-400 !border-primary-200 dark:!border-primary-800 hover:!border-primary-400 dark:hover:!border-primary-600"
    >
      <div class="inline-flex items-center gap-1.5 font-medium">
        <Upload class="w-4 h-4" aria-hidden="true" />
        <span>{{
          uploading
            ? $t('imageUpload.uploading')
            : (text ?? $t('imageUpload.upload'))
        }}</span>
      </div>
    </a-button>
  </a-upload>
</template>

<script setup lang="ts">
import { message } from 'ant-design-vue'
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import Upload from '~icons/lucide/upload'
import { uploadImage, uploadImages } from '../api/upload'

const { t } = useI18n()

/**
 * ImageUploadButton image upload button component
 *
 * @prop {Function} onSuccess - Callback after successful upload; receives the result (object for single file, array for multiple files)
 * @prop {Function} beforeUpload - Pre-upload validation function, can be used for file type and size checks
 * @prop {String} type - Button type (primary|dashed|default)
 * @prop {String} text - Button label text
 * @prop {Boolean} multiple - Whether multiple file upload is supported
 */
const props = defineProps({
  onSuccess: {
    type: Function,
    default: undefined,
  },
  beforeUpload: {
    type: Function,
    default: undefined,
  },
  type: {
    type: String,
    default: 'dashed',
  },
  text: {
    type: String,
    default: undefined,
  },
  multiple: {
    type: Boolean,
    default: false,
  },
})

const uploading = ref(false)
const fileQueue = ref<File[]>([])

const handleBeforeUpload = (file: File, fileList: File[]) => {
  if (props.beforeUpload) {
    const result = props.beforeUpload(file, fileList)
    if (result === false) {
      return false
    }
  }

  const isImage = file.type.startsWith('image/')
  if (!isImage) {
    message.error(t('imageUpload.onlyImages'))
    return false
  }

  const isLt10M = file.size / 1024 / 1024 < 10
  if (!isLt10M) {
    message.error(t('imageUpload.imageSizeLimit'))
    return false
  }

  if (props.multiple) {
    fileQueue.value = fileList
    if (file === fileList[0]) {
      return true // allow customRequest to trigger
    }
    return false // skip other files
  }

  return true // single file upload — allow directly
}

const handleUpload = async (options: any) => {
  const { file } = options

  uploading.value = true

  try {
    if (props.multiple && fileQueue.value.length > 0) {
      const results = await uploadImages(fileQueue.value)
      message.success(
        t('imageUpload.uploadCountSuccess', { count: results.length })
      )

      if (props.onSuccess) {
        props.onSuccess(results)
      }

      fileQueue.value = []
    } else {
      const result = await uploadImage(file)
      message.success(t('imageUpload.uploadSuccess'))

      if (props.onSuccess) {
        props.onSuccess(result)
      }
    }
  } catch (error: any) {
    message.error(error.message || t('imageUpload.uploadFailed'))
    console.error('Upload error:', error)
  } finally {
    uploading.value = false
  }
}
</script>
