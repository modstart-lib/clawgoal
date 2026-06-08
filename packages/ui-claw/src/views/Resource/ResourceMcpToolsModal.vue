<template>
  <a-modal
    :keyboard="false"
    :open="open"
    :title="
      $t('claw.resource.mcpToolsTitle', {
        title: mcp.title,
        count: tools.length,
      })
    "
    :footer="null"
    width="95vw"
    @cancel="emit('update:open', false)"
  >
    <div class="max-h-[65vh] overflow-y-auto">
      <div v-if="tools.length === 0" class="text-gray-400 text-center py-8">
        {{ $t('claw.resource.mcpNoTools') }}
      </div>
      <div v-else class="divide-y divide-gray-100 dark:divide-gray-700">
        <div
          v-for="(tool, index) in tools"
          :key="tool.name"
          class="flex items-start gap-3 py-2.5 px-1 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
        >
          <span
            class="text-[11px] text-gray-300 dark:text-gray-600 w-5 text-right flex-shrink-0 mt-0.5"
            >{{ index + 1 }}</span
          >
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2 flex-wrap">
              <span
                class="text-xs font-semibold font-mono text-gray-800 dark:text-gray-100"
                >{{ tool.name }}</span
              >
              <span
                v-for="(propSchema, propName) in getProperties(
                  tool.inputSchema
                )"
                :key="propName"
                class="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0 rounded bg-blue-50 dark:bg-blue-900/20 text-blue-500 dark:text-blue-400 font-mono"
              >
                {{ propName
                }}<span
                  v-if="isRequired(tool.inputSchema, propName)"
                  class="text-red-400"
                  >*</span
                >
                <span class="text-gray-400 dark:text-gray-500 ml-0.5">{{
                  getType(propSchema)
                }}</span>
              </span>
            </div>
            <p
              v-if="tool.description"
              class="text-[11px] text-gray-400 dark:text-gray-500 mt-0.5 leading-relaxed"
            >
              {{ tool.description }}
            </p>
          </div>
        </div>
      </div>
    </div>
  </a-modal>
</template>

<script setup lang="ts">
import type { McpRow } from '@/claw/api/mcp'
import { computed } from 'vue'

const props = defineProps<{
  open: boolean
  mcp: McpRow
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
}>()

interface StoredTool {
  name: string
  description?: string
  inputSchema: Record<string, unknown>
}

const tools = computed<StoredTool[]>(() => {
  if (!props.mcp.tools) return []
  return props.mcp.tools as StoredTool[]
})

function getProperties(
  schema: Record<string, unknown>
): Record<string, Record<string, unknown>> {
  return (schema?.properties ?? {}) as Record<string, Record<string, unknown>>
}

function isRequired(schema: Record<string, unknown>, name: string): boolean {
  const req = schema?.required
  return Array.isArray(req) && req.includes(name)
}

function getType(propSchema: Record<string, unknown>): string {
  return (propSchema?.type as string) ?? ''
}
</script>
