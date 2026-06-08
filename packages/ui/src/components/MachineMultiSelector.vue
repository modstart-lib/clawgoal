<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { getMachines } from '../../../ui-ops/src/api/machine'
import type { OpsMachine } from '../../../ui-ops/src/types'

const props = defineProps<{
  modelValue: number[]
  allowedIds?: number[]
}>()

const emit = defineEmits<{ 'update:modelValue': [value: number[]] }>()

const { t } = useI18n()
const machines = ref<OpsMachine[]>([])
const loading = ref(false)

const filteredMachines = computed(() =>
  props.allowedIds && props.allowedIds.length > 0
    ? machines.value.filter((m) => props.allowedIds!.includes(m.id))
    : machines.value
)

const groupedByCategory = computed(() => {
  const map = new Map<string, OpsMachine[]>()
  for (const m of filteredMachines.value) {
    const cat = m.category || t('machineMultiSelector.uncategorized')
    if (!map.has(cat)) map.set(cat, [])
    map.get(cat)!.push(m)
  }
  return map
})

async function load() {
  loading.value = true
  try {
    machines.value = await getMachines()
  } finally {
    loading.value = false
  }
}

function toggleMachine(id: number) {
  const current = [...props.modelValue]
  const idx = current.indexOf(id)
  if (idx >= 0) {
    current.splice(idx, 1)
  } else {
    current.push(id)
  }
  emit('update:modelValue', current)
}

function toggleCategory(cat: string) {
  const catMachines = groupedByCategory.value.get(cat) || []
  const catIds = catMachines.map((m) => m.id)
  const allSelected = catIds.every((id) => props.modelValue.includes(id))
  if (allSelected) {
    emit(
      'update:modelValue',
      props.modelValue.filter((id) => !catIds.includes(id))
    )
  } else {
    const newIds = [...new Set([...props.modelValue, ...catIds])]
    emit('update:modelValue', newIds)
  }
}

function isCategoryChecked(cat: string): boolean {
  const catMachines = groupedByCategory.value.get(cat) || []
  return (
    catMachines.length > 0 &&
    catMachines.every((m) => props.modelValue.includes(m.id))
  )
}

function isCategoryIndeterminate(cat: string): boolean {
  const catMachines = groupedByCategory.value.get(cat) || []
  const selected = catMachines.filter((m) => props.modelValue.includes(m.id))
  return selected.length > 0 && selected.length < catMachines.length
}

onMounted(load)
</script>

<template>
  <div
    class="border border-gray-100/80 dark:border-gray-700/50 rounded-xl bg-gray-50/50 dark:bg-gray-800/30 backdrop-blur-sm overflow-hidden"
  >
    <div v-if="loading" class="py-4 text-center text-gray-400 text-sm">
      {{ t('machineMultiSelector.loading') }}
    </div>
    <div
      v-else-if="machines.length === 0"
      class="py-4 text-center text-gray-400 text-sm"
    >
      {{ t('machineMultiSelector.noMachines') }}
    </div>
    <div v-else class="p-3 space-y-3">
      <div v-for="[cat, catMachines] in groupedByCategory" :key="cat">
        <div class="flex items-center gap-2 mb-2 px-1">
          <a-checkbox
            :checked="isCategoryChecked(cat)"
            :indeterminate="isCategoryIndeterminate(cat)"
            @change="toggleCategory(cat)"
          />
          <span
            class="text-sm font-semibold text-gray-600 dark:text-gray-400"
            >{{ cat }}</span
          >
        </div>
        <div class="grid grid-cols-2 gap-2 pl-6">
          <div
            v-for="m in catMachines"
            :key="m.id"
            class="flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-all duration-300 hover:shadow"
            :class="
              modelValue.includes(m.id)
                ? 'bg-primary-50/80 border-primary-300 dark:bg-primary-900/30 dark:border-primary-500/50'
                : 'bg-white/80 border-gray-100 dark:bg-gray-800/50 dark:border-gray-700/50 hover:bg-gray-50/90 dark:hover:bg-gray-700/80'
            "
            @click="toggleMachine(m.id)"
          >
            <a-checkbox
              :checked="modelValue.includes(m.id)"
              @click.stop
              @change="toggleMachine(m.id)"
            />
            <div class="flex-1 min-w-0">
              <div
                class="text-sm text-gray-800 dark:text-gray-200 truncate font-medium"
              >
                {{ m.title }}
              </div>
              <div class="text-xs text-gray-400 truncate">{{ m.host }}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
