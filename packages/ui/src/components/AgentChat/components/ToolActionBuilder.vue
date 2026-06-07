<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { Plus, Trash2, MessageSquare } from 'lucide-vue-next'

const { t } = useI18n()

export interface UIToolActionField {
  type: 'text' | 'radio' | 'textarea'
  name: string
  title: string
  defaultValue: string
  required: boolean
  optionsStr: string
}

export interface UIToolAction {
  type: 'form'
  icon: string
  title: string
  config: {
    fields: UIToolActionField[]
    template: string
  }
}

const props = defineProps<{
  value: UIToolAction[]
}>()

const emit = defineEmits<{
  (e: 'update:value', val: UIToolAction[]): void
}>()

function makeEmptyField(): UIToolActionField {
  return {
    type: 'text',
    name: '',
    title: '',
    defaultValue: '',
    required: false,
    optionsStr: '',
  }
}

function makeEmptyAction(): UIToolAction {
  return {
    type: 'form',
    icon: '',
    title: '',
    config: { fields: [makeEmptyField()], template: '' },
  }
}

const addToolAction = () => {
  const newActions = [...props.value]
  newActions.push(makeEmptyAction())
  emit('update:value', newActions)
}

const removeToolAction = (i: number) => {
  const newActions = [...props.value]
  newActions.splice(i, 1)
  emit('update:value', newActions)
}

const addField = (ai: number) => {
  const newActions = [...props.value]
  newActions[ai].config.fields.push(makeEmptyField())
  emit('update:value', newActions)
}

const removeField = (ai: number, fi: number) => {
  const newActions = [...props.value]
  newActions[ai].config.fields.splice(fi, 1)
  emit('update:value', newActions)
}
</script>

<template>
  <div class="tool-action-builder">
    <div
      class="text-sm font-bold text-gray-700 dark:text-gray-300 mb-3 flex items-center justify-between"
    >
      <div class="flex items-center gap-1.5">
        <MessageSquare class="w-4 h-4 text-orange-500" />
        {{
          t('agentChat.toolAction.chatActionsTitle') + ' (chats.toolActions)'
        }}
      </div>
      <a-button @click="addToolAction">
        <div class="inline-flex items-center gap-1">
          <Plus class="w-4 h-4" aria-hidden="true" />
          {{ t('agentChat.toolAction.addAction') }}
        </div>
      </a-button>
    </div>

    <div
      v-if="value.length === 0"
      class="text-sm text-gray-400 dark:text-gray-500 text-center py-6 border border-dashed rounded-lg dark:border-gray-700"
    >
      {{ t('agentChat.toolAction.noToolActions') }}
    </div>

    <div
      v-for="(action, actionIdx) in value"
      :key="actionIdx"
      class="mb-3 border rounded-lg p-3 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/40"
    >
      <!-- Action header row: icon + title + delete -->
      <div class="flex items-center gap-2 mb-3">
        <div class="flex-1 grid grid-cols-2 gap-2">
          <a-input
            v-model:value="action.title"
            :placeholder="t('agentChat.toolAction.actionTitlePlaceholder')"
          >
            <template #addonBefore>
              <span class="text-xs select-none">title</span>
            </template>
          </a-input>
          <a-input
            v-model:value="action.icon"
            :placeholder="t('agentChat.toolAction.actionIconPlaceholder')"
          >
            <template #addonBefore>
              <span class="text-xs select-none">icon</span>
            </template>
          </a-input>
        </div>
        <a-button
          danger
          class="inline-flex items-center"
          :title="t('agentChat.toolAction.removeAction')"
          @click="removeToolAction(actionIdx)"
        >
          <Trash2 class="w-4 h-4" aria-hidden="true" />
        </a-button>
      </div>

      <!-- Fields list -->
      <div class="mb-2">
        <div
          class="text-xs text-gray-500 dark:text-gray-400 mb-1.5 flex items-center justify-between"
        >
          <span class="font-mono">fields</span>
          <a-button type="dashed" @click="addField(actionIdx)">
            <div class="inline-flex items-center gap-1 text-xs">
              <Plus class="w-4 h-4" aria-hidden="true" />
              {{ t('agentChat.toolAction.addField') }}
            </div>
          </a-button>
        </div>

        <div
          v-for="(field, fieldIdx) in action.config.fields"
          :key="fieldIdx"
          class="flex flex-wrap items-center gap-1.5 mb-1.5 p-1.5 rounded bg-white dark:bg-gray-900/50 border dark:border-gray-700"
        >
          <a-select v-model:value="field.type" class="w-24 shrink-0">
            <a-select-option value="text">text</a-select-option>
            <a-select-option value="radio">radio</a-select-option>
            <a-select-option value="textarea">textarea</a-select-option>
          </a-select>
          <a-input
            v-model:value="field.name"
            :placeholder="t('agentChat.toolAction.fieldNamePlaceholder')"
            class="w-28"
          />
          <a-input
            v-model:value="field.title"
            :placeholder="t('agentChat.toolAction.fieldTitlePlaceholder')"
            class="w-28"
          />
          <a-input
            v-model:value="field.defaultValue"
            :placeholder="t('agentChat.toolAction.fieldDefaultPlaceholder')"
            class="w-24"
          />
          <!-- Options input for radio type -->
          <a-input
            v-if="field.type === 'radio'"
            v-model:value="field.optionsStr"
            :placeholder="t('agentChat.toolAction.fieldOptionsPlaceholder')"
            class="w-40"
          />
          <div class="flex items-center gap-1 text-xs text-gray-500 shrink-0">
            <!-- Ensure switches don't use size="small" according to vue rules if not needed -->
            <a-switch v-model:checked="field.required" />
            <span>req</span>
          </div>
          <a-button
            type="text"
            danger
            class="inline-flex items-center"
            :title="t('agentChat.toolAction.removeField')"
            @click="removeField(actionIdx, fieldIdx)"
          >
            <Trash2 class="w-4 h-4" aria-hidden="true" />
          </a-button>
        </div>
      </div>

      <!-- Template -->
      <div>
        <div class="text-xs font-mono text-gray-500 dark:text-gray-400 mb-1">
          template
        </div>
        <a-textarea
          v-model:value="action.config.template"
          :auto-size="{ minRows: 2, maxRows: 8 }"
          :placeholder="t('agentChat.toolAction.templatePlaceholder')"
          class="font-mono text-xs!"
        />
      </div>
    </div>
  </div>
</template>

<style scoped></style>
