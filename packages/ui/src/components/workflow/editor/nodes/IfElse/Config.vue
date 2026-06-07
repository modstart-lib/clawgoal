<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { Plus, Trash2 } from 'lucide-vue-next'
import VariableInput from '../../components/VariableInput.vue'

const { t } = useI18n()

const props = defineProps<{ node: any; properties: any }>()
const emit = defineEmits<{ 'update:properties': [val: any] }>()

interface Condition {
  id: string
  label: string
  type: 'simple' | 'code'
  value1: string
  operator: string
  value2: string
  code: string
}

const conditions = ref<Condition[]>([])

const operators = computed(() => [
  { label: t('workflowEditor.ifElseOpEq'), value: '==' },
  { label: t('workflowEditor.ifElseOpNe'), value: '!=' },
  { label: t('workflowEditor.ifElseOpGt'), value: '>' },
  { label: t('workflowEditor.ifElseOpLt'), value: '<' },
  { label: t('workflowEditor.ifElseOpGte'), value: '>=' },
  { label: t('workflowEditor.ifElseOpLte'), value: '<=' },
  { label: t('workflowEditor.ifElseOpContains'), value: 'contains' },
  { label: t('workflowEditor.ifElseOpNotContains'), value: 'not_contains' },
  { label: t('workflowEditor.ifElseOpStartsWith'), value: 'starts_with' },
  { label: t('workflowEditor.ifElseOpEndsWith'), value: 'ends_with' },
])

function makeCondition(idx: number): Condition {
  return {
    id: `cond_${Date.now()}_${idx}`,
    label: `${t('workflowEditor.ifElseCondition')} ${idx + 1}`,
    type: 'simple',
    value1: '',
    operator: '==',
    value2: '',
    code: 'return false',
  }
}

watch(
  () => props.properties?.data,
  (d) => {
    if (
      d?.conditions &&
      Array.isArray(d.conditions) &&
      d.conditions.length > 0
    ) {
      conditions.value = d.conditions
    } else if (d?.type) {
      conditions.value = [
        {
          id: 'cond_default',
          label: `${t('workflowEditor.ifElseCondition')} 1`,
          type: d.type,
          value1: d.value1 || '',
          operator: d.operator || '==',
          value2: d.value2 || '',
          code: d.code || 'return false',
        },
      ]
    } else if (!conditions.value.length) {
      conditions.value = [makeCondition(0), makeCondition(1)]
    }
  },
  { immediate: true }
)

function sync() {
  const conds = conditions.value
  emit('update:properties', {
    data: { conditions: conds },
    outputs: [
      ...conds.map((c) => ({ id: c.id, type: 'output', label: c.label })),
      {
        id: 'else',
        type: 'output',
        label: t('workflowEditor.ifElseElseLabel'),
      },
    ],
  })
}

function addCondition() {
  conditions.value.push(makeCondition(conditions.value.length))
  sync()
}

function removeCondition(idx: number) {
  if (conditions.value.length <= 1) return
  conditions.value.splice(idx, 1)
  sync()
}
</script>

<template>
  <div class="p-2 space-y-2">
    <div
      v-for="(cond, idx) in conditions"
      :key="cond.id"
      class="border border-gray-200 rounded p-2 space-y-1.5"
    >
      <div class="flex items-center gap-1.5">
        <a-input v-model:value="cond.label" class="flex-1" @change="sync" />
        <a-radio-group v-model:value="cond.type" @change="sync">
          <a-radio-button value="simple">{{
            t('workflowEditor.ifElseSimple')
          }}</a-radio-button>
          <a-radio-button value="code">{{
            t('workflowEditor.ifElseCode')
          }}</a-radio-button>
        </a-radio-group>
        <a-button
          class="inline-flex items-center"
          danger
          :disabled="conditions.length <= 1"
          @click="removeCondition(idx)"
        >
          <Trash2 class="w-4 h-4" aria-hidden="true" />
        </a-button>
      </div>
      <template v-if="cond.type === 'simple'">
        <VariableInput
          v-model="cond.value1"
          :node-id="props.node?.id"
          :placeholder="$t('workflowEditor.ifElseValue1')"
          @change="sync"
        />
        <a-select v-model:value="cond.operator" class="w-full" @change="sync">
          <a-select-option
            v-for="op in operators"
            :key="op.value"
            :value="op.value"
            >{{ op.label }}</a-select-option
          >
        </a-select>
        <VariableInput
          v-model="cond.value2"
          :node-id="props.node?.id"
          :placeholder="$t('workflowEditor.ifElseValue2')"
          @change="sync"
        />
      </template>
      <template v-else>
        <a-textarea
          v-model:value="cond.code"
          :rows="4"
          placeholder="return false"
          class="font-mono text-xs"
          @change="sync"
        />
      </template>
    </div>
    <div
      class="border border-dashed border-gray-300 rounded p-1.5 text-xs text-gray-400 text-center"
    >
      {{ t('workflowEditor.ifElseElse') }}
    </div>
    <a-button class="w-full" @click="addCondition">
      <div class="inline-flex items-center gap-1">
        <Plus class="w-4 h-4" aria-hidden="true" />{{
          t('workflowEditor.ifElseAddCondition')
        }}
      </div>
    </a-button>
  </div>
</template>
