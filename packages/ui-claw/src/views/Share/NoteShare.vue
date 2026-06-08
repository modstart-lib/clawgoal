<script setup lang="ts">
import MarkdownViewer from '@/components/MarkdownViewer.vue'
import { copyText, setPageTitle } from '@/utils/utils'
import { onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import Copy from '~icons/lucide/copy'
import Lock from '~icons/lucide/lock'

const { t } = useI18n()

const route = useRoute()

interface ShareData {
  title: string
  type: string
  content: {
    markdown: string
    html: string
  }
  error?: string
}

const loading = ref(true)
const data = ref<ShareData | null>(null)
const notFound = ref(false)

onMounted(async () => {
  const idHash = route.params.idHash as string
  try {
    const res = await fetch(`/api/claw/note/share/${idHash}`)
    const json = await res.json()
    if (res.status === 404 || json.error) {
      notFound.value = true
    } else {
      data.value = json
      setPageTitle(json.title)
    }
  } catch {
    notFound.value = true
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div class="min-h-screen bg-gray-50 py-10 px-4">
    <!-- 加载中 -->
    <div v-if="loading" class="flex items-center justify-center min-h-screen">
      <a-spin size="large" />
    </div>

    <!-- 链接无效 -->
    <div
      v-else-if="notFound"
      class="flex flex-col items-center justify-center min-h-screen text-gray-400"
    >
      <Lock class="w-12 h-12 mb-4 opacity-40" aria-hidden="true" />
      <div class="text-base">{{ t('claw.share.invalidLink') }}</div>
    </div>

    <!-- 内容 -->
    <div v-else-if="data" class="max-w-2xl mx-auto">
      <div class="bg-white border border-gray-200 rounded-2xl overflow-hidden">
        <!-- 头部 -->
        <div class="px-8 py-6 border-b border-gray-100">
          <div class="text-xl font-bold text-gray-900 mb-3 break-words">
            {{ data.title }}
          </div>
          <div v-if="data.type" class="mb-3">
            <span
              class="inline-flex items-center px-2 py-0.5 rounded text-xs bg-indigo-50 text-indigo-600"
            >
              {{ data.type }}
            </span>
          </div>
          <div class="flex flex-wrap gap-2">
            <a-button size="small" @click="copyText(data!.title)">
              <div class="inline-flex items-center gap-1">
                <Copy class="w-3 h-3" aria-hidden="true" />{{
                  t('claw.share.copyTitle')
                }}
              </div>
            </a-button>
            <a-button
              v-if="data.content.markdown"
              size="small"
              @click="copyText(data!.content.markdown)"
            >
              <div class="inline-flex items-center gap-1">
                <Copy class="w-3 h-3" aria-hidden="true" />{{
                  t('claw.share.copyBodyMarkdown')
                }}
              </div>
            </a-button>
            <a-button
              v-if="data.content.html"
              size="small"
              @click="copyText(data!.content.html)"
            >
              <div class="inline-flex items-center gap-1">
                <Copy class="w-3 h-3" aria-hidden="true" />{{
                  t('claw.share.copyBodyHtml')
                }}
              </div>
            </a-button>
          </div>
        </div>
        <!-- 正文 -->
        <div class="px-8 py-7">
          <MarkdownViewer
            v-if="data.content.markdown"
            :content="data.content.markdown"
          />
          <div v-else class="text-gray-400 text-sm">
            {{ t('claw.share.noContent') }}
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
