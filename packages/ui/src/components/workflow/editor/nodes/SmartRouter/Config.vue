<script setup lang="ts">
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { Plus, Trash2 } from 'lucide-vue-next'
import ModelSelector from '@/components/ModelSelector.vue'
import ModelViewer from '@/components/ModelViewer.vue'
import VariableTextareaInput from '../../components/VariableTextareaInput.vue'

const props = defineProps<{ node: any; properties: any }>()
const emit = defineEmits<{ 'update:properties': [val: any] }>()

interface Branch {
  id: string
  name: string
  description: string
}

const { t } = useI18n()

const model = ref('')
const branches = ref<Branch[]>([])
const input = ref('')

watch(
  () => props.properties,
  (p) => {
    model.value = p?.data?.model || ''
    branches.value = p?.data?.branches ? [...p.data.branches] : []
    const inputField = p?.inputFields?.find((f: any) => f.name === 'Input')
    input.value = inputField?.value || ''
  },
  { immediate: true }
)

function makeBranch(): Branch {
  return {
    id: `branch_${Date.now()}`,
    name: '',
    description: '',
  }
}

function sync() {
  const bs = branches.value
  const inputFields = [{ name: 'Input', type: 'textarea', value: input.value }]
  emit('update:properties', {
    data: { model: model.value, branches: bs },
    inputFields,
    outputs: [
      ...bs.map((b) => ({
        id: b.id,
        type: 'output',
        label: b.name || t('workflowEditor.routerBranch'),
      })),
      {
        id: 'default',
        type: 'output',
        label: t('workflowEditor.routerDefault'),
      },
    ],
  })
}

function addBranch() {
  branches.value.push(makeBranch())
  sync()
}

function removeBranch(idx: number) {
  if (branches.value.length <= 1) return
  branches.value.splice(idx, 1)
  sync()
}
</script>

<template>
  <div class="p-2 space-y-2">
    <div>
      <div class="text-xs text-gray-500 mb-1">
        {{ t('workflowEditor.llmModel') }}
      </div>
      <ModelSelector v-model:value="model" @update:value="sync" />
      <ModelViewer v-if="model" :value="model" class="mt-1.5 w-full" />
    </div>
    <div>
      <div class="text-xs text-gray-500 mb-1">
        {{ t('workflowEditor.routerInputContent') }}
      </div>
      <VariableTextareaInput
        v-model="input"
        :rows="2"
        :node-id="props.node?.id"
        :placeholder="t('workflowEditor.routerInputPlaceholder')"
        @change="sync"
      />
    </div>
    <div>
      <div class="flex items-center justify-between mb-1">
        <span class="text-xs text-gray-500">{{
          t('workflowEditor.routerBranchList')
        }}</span>
        <a-button @click="addBranch">
          <div class="inline-flex items-center gap-1">
            <Plus class="w-4 h-4" aria-hidden="true" />{{
              t('workflowEditor.routerAddBranch')
            }}
          </div>
        </a-button>
      </div>
      <div class="space-y-2">
        <div
          v-for="(branch, idx) in branches"
          :key="branch.id"
          class="border border-gray-200 rounded p-1.5 space-y-1"
        >
          <div class="flex items-center gap-1.5">
            <a-input
              v-model:value="branch.name"
              :placeholder="t('workflowEditor.routerBranchNamePlaceholder')"
              class="flex-1"
              @change="sync"
            />
            <a-button
              class="inline-flex items-center"
              danger
              :disabled="branches.length <= 1"
              @click="removeBranch(idx)"
            >
              <Trash2 class="w-4 h-4" aria-hidden="true" />
            </a-button>
          </div>
          <a-input
            v-model:value="branch.description"
            :placeholder="t('workflowEditor.routerBranchCondPlaceholder')"
            @change="sync"
          />
        </div>
      </div>
    </div>
    <div
      class="border border-dashed border-gray-300 rounded p-1.5 text-xs text-gray-400 text-center"
    >
      {{ t('workflowEditor.routerDefaultDesc') }}
    </div>
  </div>
</template>
