<script setup lang="ts">
import { computed } from 'vue'
import FileArchive from '~icons/lucide/file-archive'
import FileCode from '~icons/lucide/file-code'
import FileImage from '~icons/lucide/file-image'
import FileJson from '~icons/lucide/file-json'
import FileMusic from '~icons/lucide/file-music'
import FileText from '~icons/lucide/file-text'
import FileVideo from '~icons/lucide/file-video'
import File from '~icons/lucide/file'
import Terminal from '~icons/lucide/terminal'

const props = defineProps<{
  path: string
}>()

const EXT_MAP: Record<string, { icon: unknown; color: string }> = {
  // 图片
  jpg: { icon: FileImage, color: 'text-pink-400' },
  jpeg: { icon: FileImage, color: 'text-pink-400' },
  png: { icon: FileImage, color: 'text-pink-400' },
  gif: { icon: FileImage, color: 'text-pink-400' },
  svg: { icon: FileImage, color: 'text-pink-400' },
  webp: { icon: FileImage, color: 'text-pink-400' },
  ico: { icon: FileImage, color: 'text-pink-400' },
  bmp: { icon: FileImage, color: 'text-pink-400' },
  // 视频
  mp4: { icon: FileVideo, color: 'text-purple-400' },
  avi: { icon: FileVideo, color: 'text-purple-400' },
  mov: { icon: FileVideo, color: 'text-purple-400' },
  mkv: { icon: FileVideo, color: 'text-purple-400' },
  webm: { icon: FileVideo, color: 'text-purple-400' },
  flv: { icon: FileVideo, color: 'text-purple-400' },
  // 音频
  mp3: { icon: FileMusic, color: 'text-orange-400' },
  wav: { icon: FileMusic, color: 'text-orange-400' },
  flac: { icon: FileMusic, color: 'text-orange-400' },
  ogg: { icon: FileMusic, color: 'text-orange-400' },
  aac: { icon: FileMusic, color: 'text-orange-400' },
  // 压缩包
  zip: { icon: FileArchive, color: 'text-yellow-500' },
  tar: { icon: FileArchive, color: 'text-yellow-500' },
  gz: { icon: FileArchive, color: 'text-yellow-500' },
  rar: { icon: FileArchive, color: 'text-yellow-500' },
  '7z': { icon: FileArchive, color: 'text-yellow-500' },
  bz2: { icon: FileArchive, color: 'text-yellow-500' },
  // 代码
  js: { icon: FileCode, color: 'text-yellow-400' },
  ts: { icon: FileCode, color: 'text-blue-400' },
  vue: { icon: FileCode, color: 'text-green-500' },
  jsx: { icon: FileCode, color: 'text-cyan-400' },
  tsx: { icon: FileCode, color: 'text-cyan-400' },
  py: { icon: FileCode, color: 'text-blue-500' },
  go: { icon: FileCode, color: 'text-cyan-500' },
  rs: { icon: FileCode, color: 'text-orange-500' },
  java: { icon: FileCode, color: 'text-red-400' },
  cpp: { icon: FileCode, color: 'text-blue-400' },
  c: { icon: FileCode, color: 'text-blue-400' },
  h: { icon: FileCode, color: 'text-blue-300' },
  css: { icon: FileCode, color: 'text-blue-400' },
  scss: { icon: FileCode, color: 'text-pink-400' },
  html: { icon: FileCode, color: 'text-orange-400' },
  // 数据
  json: { icon: FileJson, color: 'text-amber-400' },
  yaml: { icon: FileJson, color: 'text-amber-400' },
  yml: { icon: FileJson, color: 'text-amber-400' },
  toml: { icon: FileJson, color: 'text-amber-400' },
  xml: { icon: FileJson, color: 'text-amber-400' },
  csv: { icon: FileJson, color: 'text-green-400' },
  // 脚本
  sh: { icon: Terminal, color: 'text-gray-500' },
  bash: { icon: Terminal, color: 'text-gray-500' },
  zsh: { icon: Terminal, color: 'text-gray-500' },
  // 文本/文档
  txt: { icon: FileText, color: 'text-gray-400' },
  md: { icon: FileText, color: 'text-gray-500' },
  log: { icon: FileText, color: 'text-gray-400' },
  pdf: { icon: FileText, color: 'text-red-500' },
}

const iconInfo = computed(() => {
  const ext = (props.path.split('.').pop() ?? '').toLowerCase()
  return EXT_MAP[ext] ?? { icon: File, color: 'text-gray-400' }
})
</script>

<template>
  <component :is="iconInfo.icon" class="shrink-0" :class="iconInfo.color" />
</template>
