<template>
  <div class="flex h-full overflow-hidden">
    <!-- 左侧：手风琴文件导航 -->
    <div
      class="w-64 shrink-0 flex flex-col border-r border-gray-200 overflow-y-auto bg-gray-50"
    >
      <div
        v-for="proj in projectList"
        :key="proj"
        class="border-b border-gray-100 last:border-b-0"
      >
        <!-- 项目标题（可折叠） -->
        <div
          class="flex items-center gap-1.5 px-3 py-2 cursor-pointer select-none hover:bg-gray-100 transition-colors"
          @click="toggleProject(proj)"
        >
          <ChevronRight
            class="w-3.5 h-3.5 text-gray-400 transition-transform shrink-0"
            :class="expandedProjects.has(proj) ? 'rotate-90' : ''"
            aria-hidden="true"
          />
          <span class="text-xs font-medium text-gray-700 truncate flex-1">{{
            proj
          }}</span>
          <span class="text-xs text-gray-400 shrink-0">{{
            filesForProject(proj).length
          }}</span>
        </div>
        <!-- 文件列表 -->
        <div v-if="expandedProjects.has(proj)" class="pb-1">
          <div
            v-for="file in filesForProject(proj)"
            :key="file.path"
            class="flex items-center gap-1.5 pl-6 pr-3 py-1 cursor-pointer text-xs transition-colors"
            :class="
              activeFileKey === proj + ':' + file.path
                ? 'bg-blue-50 text-blue-700'
                : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700'
            "
            @click="scrollToFile(proj, file.path)"
          >
            <span
              class="w-1.5 h-1.5 rounded-full shrink-0"
              :class="
                file.adds > 0 && file.dels > 0
                  ? 'bg-yellow-400'
                  : file.adds > 0
                    ? 'bg-green-500'
                    : 'bg-red-400'
              "
            />
            <span class="flex-1 truncate font-mono">{{
              file.path.split('/').pop()
            }}</span>
            <span class="text-green-600 shrink-0">+{{ file.adds }}</span>
            <span class="text-red-400 shrink-0">-{{ file.dels }}</span>
          </div>
        </div>
      </div>
      <div
        v-if="projectList.length === 0"
        class="px-3 py-6 text-xs text-gray-400 text-center"
      >
        {{ t('claw.compAuditDiffViewer.noChanges') }}
      </div>
    </div>

    <!-- 右侧：连续滚动 diff -->
    <div ref="scrollContainer" class="flex-1 overflow-y-auto bg-white">
      <template v-for="proj in projectList" :key="proj">
        <template
          v-for="file in filesForProject(proj)"
          :key="proj + ':' + file.path"
        >
          <!-- 文件锚点标题 -->
          <div
            :ref="(el) => setFileRef(proj, file.path, el)"
            class="sticky top-0 z-10 flex items-center gap-2 px-4 py-2 bg-gray-100 border-b border-gray-200 text-xs font-mono"
          >
            <span class="text-gray-400">{{ proj }}</span>
            <span class="text-gray-300">/</span>
            <span class="text-gray-700 font-medium">{{ file.path }}</span>
            <span class="ml-auto text-green-600">+{{ file.adds }}</span>
            <span class="text-red-400">-{{ file.dels }}</span>
          </div>
          <!-- diff 内容 -->
          <div class="border-b border-gray-100">
            <DiffView
              v-if="getDiffFile(proj, file.path)"
              :diff-file="getDiffFile(proj, file.path)!"
              :diff-view-mode="DiffModeEnum.Unified"
              :diff-view-highlight="true"
              :diff-view-wrap="true"
              :diff-view-font-size="12"
              diff-view-theme="light"
            />
            <div v-else class="px-4 py-6 text-xs text-gray-400 text-center">
              {{ t('claw.compAuditDiffViewer.noDiff') }}
            </div>
          </div>
        </template>
      </template>
      <div
        v-if="projectList.length === 0"
        class="flex items-center justify-center h-full text-gray-400 text-sm"
      >
        {{ t('claw.compAuditDiffViewer.noChangesContent') }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { DiffFile, DiffModeEnum, DiffView } from '@git-diff-view/vue'
import '@git-diff-view/vue/styles/diff-view.css'
import ChevronRight from '~icons/lucide/chevron-right'

interface FileStats {
  path: string
  adds: number
  dels: number
}

const props = defineProps<{
  diffs: Record<string, string>
}>()

const scrollContainer = ref<HTMLElement | null>(null)
const fileRefs = ref<Map<string, Element>>(new Map())
const activeFileKey = ref('')
const { t } = useI18n()
const expandedProjects = ref<Set<string>>(new Set())

const projectList = computed(() => Object.keys(props.diffs))

// 初始展开所有项目
watch(
  projectList,
  (list) => {
    list.forEach((p) => expandedProjects.value.add(p))
  },
  { immediate: true }
)

function toggleProject(proj: string) {
  if (expandedProjects.value.has(proj)) {
    expandedProjects.value.delete(proj)
  } else {
    expandedProjects.value.add(proj)
  }
}

function parseFiles(diff: string): FileStats[] {
  const files: FileStats[] = []
  let currentFile = ''
  let adds = 0
  let dels = 0
  for (const line of diff.split('\n')) {
    if (line.startsWith('diff --git ')) {
      if (currentFile) files.push({ path: currentFile, adds, dels })
      const m = line.match(/b\/(.+)$/)
      currentFile = m ? m[1] : line
      adds = 0
      dels = 0
    } else if (line.startsWith('+') && !line.startsWith('+++')) {
      adds++
    } else if (line.startsWith('-') && !line.startsWith('---')) {
      dels++
    }
  }
  if (currentFile) files.push({ path: currentFile, adds, dels })
  return files
}

function filesForProject(proj: string): FileStats[] {
  const diff = props.diffs[proj] ?? ''
  return parseFiles(diff)
}

// 解析单个文件的 diff 片段并构建 DiffFile 实例
const diffFileCache = ref<Map<string, DiffFile>>(new Map())

function buildDiffFile(proj: string, filePath: string): DiffFile | null {
  const key = proj + ':' + filePath
  if (diffFileCache.value.has(key)) return diffFileCache.value.get(key)!
  const diff = props.diffs[proj] ?? ''
  const sections = diff.split(/^diff --git /m)
  for (const section of sections) {
    if (section.includes(`b/${filePath}`)) {
      const raw = 'diff --git ' + section
      try {
        // 提取文件名
        const oldMatch = raw.match(/^--- a\/(.+)$/m)
        const newMatch = raw.match(/^\+\+\+ b\/(.+)$/m)
        const oldName = oldMatch ? oldMatch[1] : filePath
        const newName = newMatch ? newMatch[1] : filePath
        const instance = new DiffFile(
          oldName,
          '',
          newName,
          '',
          [raw],
          undefined
        )
        instance.init()
        instance.buildSplitDiffLines()
        instance.buildUnifiedDiffLines()
        diffFileCache.value.set(key, instance)
        return instance
      } catch {
        return null
      }
    }
  }
  return null
}

function getDiffFile(proj: string, filePath: string): DiffFile | null {
  return buildDiffFile(proj, filePath)
}

// 重建缓存当 diffs 变化
watch(
  () => props.diffs,
  () => {
    diffFileCache.value.clear()
  },
  { deep: true }
)

// 文件 ref 注册
function setFileRef(proj: string, filePath: string, el: unknown) {
  const key = proj + ':' + filePath
  if (el instanceof Element) {
    fileRefs.value.set(key, el)
  } else {
    fileRefs.value.delete(key)
  }
}

// 点击左侧文件名滚动到对应位置
function scrollToFile(proj: string, filePath: string) {
  const key = proj + ':' + filePath
  activeFileKey.value = key
  // 确保项目已展开
  expandedProjects.value.add(proj)
  const el = fileRefs.value.get(key)
  if (el && scrollContainer.value) {
    const containerTop = scrollContainer.value.getBoundingClientRect().top
    const elTop = el.getBoundingClientRect().top
    scrollContainer.value.scrollTop += elTop - containerTop - 4
  }
}

// 滚动时更新 activeFileKey
onMounted(() => {
  const container = scrollContainer.value
  if (!container) return
  container.addEventListener('scroll', () => {
    const containerTop = container.getBoundingClientRect().top
    let closest = ''
    let closestDist = Infinity
    fileRefs.value.forEach((el, key) => {
      const dist = Math.abs(el.getBoundingClientRect().top - containerTop)
      if (dist < closestDist) {
        closestDist = dist
        closest = key
      }
    })
    if (closest) activeFileKey.value = closest
  })
})
</script>
