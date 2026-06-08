<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    provider: string
    model?: string
    size?: number
    class?: string
  }>(),
  {
    model: '',
    size: 20,
    class: '',
  }
)

const knownProviders = new Set([
  'openai',
  'claude',
  'anthropic',
  'gemini',
  'google',
  'deepseek',
  'ollama',
  'azureopenai',
  'qwen',
  'alibaba',
  'moonshot',
  'kimi',
  'zhipu',
  'glm',
  'openrouter',
])

function inferProviderFromModel(m: string): string {
  const name = m.toLowerCase()
  if (
    name.includes('gpt') ||
    name.includes('o1') ||
    name.includes('o3') ||
    name.includes('o4')
  )
    return 'openai'
  if (name.includes('claude')) return 'claude'
  if (name.includes('gemini')) return 'gemini'
  if (name.includes('deepseek')) return 'deepseek'
  if (name.includes('qwen')) return 'qwen'
  if (name.includes('moonshot') || name.includes('kimi')) return 'moonshot'
  if (name.includes('glm') || name.includes('chatglm')) return 'zhipu'
  if (
    name.includes('llama') ||
    name.includes('mistral') ||
    name.includes('phi') ||
    name.includes('qwen')
  )
    return 'ollama'
  return ''
}

const effectiveProvider = computed(() => {
  if (knownProviders.has(props.provider)) return props.provider
  if (props.model) {
    const inferred = inferProviderFromModel(props.model)
    if (inferred) return inferred
  }
  return props.provider
})
</script>

<template>
  <!-- OpenAI — official blossom / gear-star mark -->
  <svg
    v-if="effectiveProvider === 'openai'"
    :width="size"
    :height="size"
    viewBox="0 0 24 24"
    fill="currentColor"
    :class="[props.class, 'text-gray-900 dark:text-gray-100']"
    aria-hidden="true"
  >
    <path
      d="M22.282 9.821a5.985 5.985 0 0 0-.516-4.91 6.046 6.046 0 0 0-6.51-2.9 6.065 6.065 0 0 0-10.775 2.918 5.985 5.985 0 0 0-3.998 2.9 6.046 6.046 0 0 0 .743 7.097 5.98 5.98 0 0 0 .511 4.911 6.051 6.051 0 0 0 6.515 2.9A5.985 5.985 0 0 0 13.26 24a6.056 6.056 0 0 0 5.772-4.206 5.99 5.99 0 0 0 3.997-2.9 6.056 6.056 0 0 0-.747-7.073zm-9.022 12.608a4.476 4.476 0 0 1-2.876-1.04l.141-.081 4.779-2.758a.795.795 0 0 0 .392-.681v-6.737l2.02 1.168a.071.071 0 0 1 .038.052v5.583a4.504 4.504 0 0 1-4.494 4.494zM3.6 18.304a4.47 4.47 0 0 1-.535-3.014l.142.085 4.783 2.759a.771.771 0 0 0 .78 0l5.843-3.369v2.332a.08.08 0 0 1-.033.062L9.74 19.95A4.499 4.499 0 0 1 3.6 18.304zm-1.26-10.408a4.485 4.485 0 0 1 2.366-1.973V11.6a.766.766 0 0 0 .388.676l5.815 3.355-2.02 1.168a.076.076 0 0 1-.071 0l-4.83-2.786A4.504 4.504 0 0 1 2.34 7.896zm16.598 3.855-5.843-3.368 2.02-1.168a.076.076 0 0 1 .071 0l4.83 2.791a4.494 4.494 0 0 1-.678 8.105v-5.678a.79.79 0 0 0-.4-.682zm2.01-3.023-.141-.085-4.774-2.782a.776.776 0 0 0-.785 0L9.409 9.23V6.897a.066.066 0 0 1 .028-.061l4.83-2.787a4.5 4.5 0 0 1 6.68 4.66zm-12.64 4.135-2.02-1.164a.08.08 0 0 1-.038-.057V6.075a4.5 4.5 0 0 1 7.375-3.453l-.142.08-4.778 2.758a.795.795 0 0 0-.393.681zm1.097-2.365 2.602-1.5 2.607 1.5v2.999l-2.597 1.5-2.607-1.5z"
    />
  </svg>

  <!-- Anthropic Claude (‘claude’ canonical type, ‘anthropic’ legacy alias) -->
  <svg
    v-else-if="
      effectiveProvider === 'claude' || effectiveProvider === 'anthropic'
    "
    :width="size"
    :height="size"
    viewBox="0 0 24 24"
    fill="currentColor"
    :class="[props.class, 'text-[#D4845A] dark:text-[#E8956D]']"
    aria-hidden="true"
  >
    <path
      d="M13.827 3.386h-3.593L4.5 20.614h3.604l1.328-3.768h5.14l1.337 3.768H19.5Zm-3.564 10.513 1.74-4.934 1.742 4.934Z"
    />
  </svg>

  <!-- Google Gemini (‘gemini’ canonical type, ‘google’ legacy alias) — 4-pointed diamond star -->
  <svg
    v-else-if="effectiveProvider === 'gemini' || effectiveProvider === 'google'"
    :width="size"
    :height="size"
    viewBox="0 0 24 24"
    fill="none"
    :class="[props.class, 'text-[#4285F4] dark:text-[#5A9CF8]']"
    aria-hidden="true"
  >
    <!-- vertical diamond -->
    <path
      d="M12 2C11.5 5.5 10 9 8.5 10.5C7 12 4 12 2 12C4 12 7 12 8.5 13.5C10 15 11.5 18.5 12 22C12.5 18.5 14 15 15.5 13.5C17 12 20 12 22 12C20 12 17 12 15.5 10.5C14 9 12.5 5.5 12 2Z"
      fill="currentColor"
    />
  </svg>

  <!-- DeepSeek — stylised whale -->
  <svg
    v-else-if="effectiveProvider === 'deepseek'"
    :width="size"
    :height="size"
    viewBox="0 0 24 24"
    fill="none"
    :class="[props.class, 'text-[#4D6BFE] dark:text-[#8099FF]']"
    aria-hidden="true"
  >
    <!-- body -->
    <ellipse cx="11" cy="13" rx="7" ry="5.5" fill="currentColor" />
    <!-- dorsal fin -->
    <path
      d="M11 7.5C11 7.5 13.5 4.5 15.5 7C13.5 7.5 12.5 8.5 11 7.5Z"
      fill="currentColor"
    />
    <!-- tail fin -->
    <path
      d="M17.5 12.5C19.5 11 21.5 10.5 22 12C22.5 13.5 20.5 15 18 14.5"
      fill="currentColor"
    />
    <!-- eye -->
    <circle cx="8.5" cy="13" r="1" fill="white" />
    <circle cx="8.8" cy="12.8" r="0.45" fill="currentColor" />
    <!-- smile -->
    <path
      d="M9.5 15.5Q11 16.5 13 15.5"
      stroke="white"
      stroke-width="0.8"
      stroke-linecap="round"
      fill="none"
    />
  </svg>

  <!-- Ollama — simplified llama head -->
  <svg
    v-else-if="effectiveProvider === 'ollama'"
    :width="size"
    :height="size"
    viewBox="0 0 24 24"
    fill="none"
    :class="[props.class, 'text-gray-700 dark:text-gray-300']"
    aria-hidden="true"
  >
    <!-- ears -->
    <ellipse cx="8.5" cy="4.8" rx="1.3" ry="2.2" fill="currentColor" />
    <ellipse cx="15.5" cy="4.8" rx="1.3" ry="2.2" fill="currentColor" />
    <!-- head -->
    <ellipse cx="12" cy="9.5" rx="5.5" ry="5" fill="currentColor" />
    <!-- eyes -->
    <circle cx="10" cy="9" r="1.1" fill="white" />
    <circle cx="14" cy="9" r="1.1" fill="white" />
    <circle cx="10.3" cy="9" r="0.5" fill="currentColor" />
    <circle cx="14.3" cy="9" r="0.5" fill="currentColor" />
    <!-- snout -->
    <ellipse cx="12" cy="12" rx="2.5" ry="1.5" fill="currentColor" />
    <!-- nostrils -->
    <circle cx="11.2" cy="12" r="0.35" fill="currentColor" />
    <circle cx="12.8" cy="12" r="0.35" fill="currentColor" />
    <!-- neck/body -->
    <path
      d="M8 14.5C8 14.5 9.5 16 12 16C14.5 16 16 14.5 16 14.5V19C16 20.1 15.1 21 14 21H10C8.9 21 8 20.1 8 19V14.5Z"
      fill="currentColor"
    />
  </svg>

  <!-- Azure OpenAI — Azure "A" blade mark -->
  <svg
    v-else-if="effectiveProvider === 'azureopenai'"
    :width="size"
    :height="size"
    viewBox="0 0 24 24"
    fill="none"
    :class="[props.class, 'text-[#0078D4] dark:text-[#2B9EE8]']"
    aria-hidden="true"
  >
    <path
      d="M5.5 20.5L10.2 4.5H14L9.8 15.5L16.5 15.5L5.5 20.5Z"
      fill="currentColor"
    />
    <path
      d="M10.5 4.5H14.5L19 20.5L14.2 18L10.2 15.5L14.5 9.5L10.5 4.5Z"
      fill="currentColor"
    />
  </svg>

  <!-- Alibaba Qwen — stylised "Q" flame -->
  <svg
    v-else-if="effectiveProvider === 'qwen' || effectiveProvider === 'alibaba'"
    :width="size"
    :height="size"
    viewBox="0 0 24 24"
    fill="none"
    :class="[props.class, 'text-[#6554C0] dark:text-[#8B7FE8]']"
    aria-hidden="true"
  >
    <!-- outer ring -->
    <circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.8" />
    <!-- inner "q" dot -->
    <circle cx="12" cy="10.5" r="3.2" fill="currentColor" />
    <!-- descender tail -->
    <path
      d="M14.2 12.8L16.5 17"
      stroke="currentColor"
      stroke-width="1.8"
      stroke-linecap="round"
    />
  </svg>

  <!-- Moonshot / Kimi — crescent moon -->
  <svg
    v-else-if="effectiveProvider === 'moonshot' || effectiveProvider === 'kimi'"
    :width="size"
    :height="size"
    viewBox="0 0 24 24"
    fill="none"
    :class="[props.class, 'text-gray-800 dark:text-gray-200']"
    aria-hidden="true"
  >
    <path
      d="M21 12.79A9 9 0 0 1 11.21 3a7 7 0 1 0 9.79 9.79z"
      fill="currentColor"
    />
    <circle cx="17" cy="6.5" r="1" fill="currentColor" />
    <circle cx="19.5" cy="9.5" r="0.6" fill="currentColor" />
  </svg>

  <!-- Zhipu GLM — stylised "Z" spark -->
  <svg
    v-else-if="effectiveProvider === 'zhipu' || effectiveProvider === 'glm'"
    :width="size"
    :height="size"
    viewBox="0 0 24 24"
    fill="none"
    :class="[props.class, 'text-[#4B5EFF] dark:text-[#7B8FFF]']"
    aria-hidden="true"
  >
    <rect x="3" y="3" width="18" height="18" rx="4" fill="currentColor" />
    <path
      d="M7 8h10L7 16h10"
      stroke="white"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
    />
  </svg>

  <!-- OpenRouter — network hub -->
  <svg
    v-else-if="effectiveProvider === 'openrouter'"
    :width="size"
    :height="size"
    viewBox="0 0 24 24"
    fill="none"
    :class="[props.class, 'text-[#6C47FF] dark:text-[#9B87F5]']"
    aria-hidden="true"
  >
    <!-- center hub -->
    <circle cx="12" cy="12" r="2.5" fill="currentColor" />
    <!-- spokes -->
    <circle cx="12" cy="4" r="1.8" fill="currentColor" />
    <circle cx="20" cy="12" r="1.8" fill="currentColor" />
    <circle cx="12" cy="20" r="1.8" fill="currentColor" />
    <circle cx="4" cy="12" r="1.8" fill="currentColor" />
    <line
      x1="12"
      y1="9.5"
      x2="12"
      y2="5.8"
      stroke="currentColor"
      stroke-width="1.5"
    />
    <line
      x1="14.5"
      y1="12"
      x2="18.2"
      y2="12"
      stroke="currentColor"
      stroke-width="1.5"
    />
    <line
      x1="12"
      y1="14.5"
      x2="12"
      y2="18.2"
      stroke="currentColor"
      stroke-width="1.5"
    />
    <line
      x1="9.5"
      y1="12"
      x2="5.8"
      y2="12"
      stroke="currentColor"
      stroke-width="1.5"
    />
  </svg>

  <!-- Custom / fallback — gear icon -->
  <svg
    v-else
    :width="size"
    :height="size"
    viewBox="0 0 24 24"
    fill="none"
    :class="[props.class, 'text-gray-500 dark:text-gray-400']"
    aria-hidden="true"
  >
    <circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="1.5" />
    <path
      d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"
      stroke="currentColor"
      stroke-width="1.5"
      stroke-linecap="round"
      stroke-linejoin="round"
    />
  </svg>
</template>
