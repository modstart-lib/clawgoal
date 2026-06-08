<script setup lang="ts">
import { message } from 'ant-design-vue'
import { onMounted, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  type ParamConfigGroup,
  type ParamConfigItem,
  userParamBatchGet,
  userParamBatchSet,
} from '../api/userParam'

const { t } = useI18n()

const props = defineProps<{
  paramConfig: ParamConfigGroup[]
}>()

// 每个 group 的当前值
const groupValues = reactive<Record<string, Record<string, string>>>({})
// 每个 group 的保存中状态
const groupSaving = reactive<Record<string, boolean>>({})
// 展开的 panel keys（默认全部展开）
const expandedGroups = ref<string[]>([])

const loading = ref(false)

onMounted(async () => {
  loading.value = true
  try {
    const allDefaults: Record<string, string> = {}
    for (const group of props.paramConfig) {
      for (const param of group.params) {
        allDefaults[param.name] = String(param.defaultValue)
      }
    }
    if (Object.keys(allDefaults).length === 0) return

    const values = await userParamBatchGet(allDefaults)

    for (const group of props.paramConfig) {
      groupValues[group.group] = {}
      for (const param of group.params) {
        groupValues[group.group][param.name] =
          values[param.name] ?? String(param.defaultValue)
      }
    }
    expandedGroups.value = props.paramConfig.map((g) => g.group)
  } finally {
    loading.value = false
  }
})

function getValue(groupName: string, paramName: string): string {
  return groupValues[groupName]?.[paramName] ?? ''
}

function setValue(groupName: string, paramName: string, val: string) {
  if (!groupValues[groupName]) groupValues[groupName] = {}
  groupValues[groupName][paramName] = val
}

function getOptions(
  param: ParamConfigItem
): { value: string; title: string }[] {
  if (param.type === 'select' || param.type === 'checkbox') return param.options
  return []
}

function getCheckboxValue(groupName: string, paramName: string): string[] {
  return getValue(groupName, paramName).split(',').filter(Boolean)
}

function setCheckboxValue(
  groupName: string,
  paramName: string,
  vals: string[]
) {
  setValue(groupName, paramName, vals.join(','))
}

function onTextChange(groupName: string, paramName: string, e: Event) {
  setValue(groupName, paramName, (e.target as HTMLInputElement).value)
}

function onEnableChange(
  groupName: string,
  paramName: string,
  checked: boolean
) {
  setValue(groupName, paramName, checked ? 'true' : 'false')
}

async function saveGroup(group: ParamConfigGroup) {
  groupSaving[group.group] = true
  try {
    const params: Record<string, string> = {}
    for (const param of group.params) {
      params[param.name] =
        groupValues[group.group]?.[param.name] ?? String(param.defaultValue)
    }
    await userParamBatchSet(params)
    message.success(t('common.saveSuccess'))
  } catch {
    message.error(t('common.saveFailed'))
  } finally {
    groupSaving[group.group] = false
  }
}
</script>

<template>
  <div v-if="loading" class="py-4 text-center text-sm text-gray-400">
    {{ t('common.loading') }}
  </div>
  <a-collapse v-else v-model:active-key="expandedGroups">
    <a-collapse-panel
      v-for="group in paramConfig"
      :key="group.group"
      :header="group.group"
      class="mb-4"
    >
      <div class="space-y-4">
        <div v-for="param in group.params" :key="param.name">
          <div
            class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
          >
            {{ param.title }}
          </div>
          <!-- text 类型 -->
          <a-input
            v-if="param.type === 'text'"
            :value="getValue(group.group, param.name)"
            :placeholder="param.defaultValue"
            class="w-full"
            @change="onTextChange(group.group, param.name, $event)"
          />
          <!-- switch 类型 -->
          <a-switch
            v-else-if="param.type === 'switch'"
            :checked="getValue(group.group, param.name) === 'true'"
            @change="onEnableChange(group.group, param.name, $event)"
          />
          <!-- select 类型 -->
          <a-select
            v-else-if="param.type === 'select'"
            :value="getValue(group.group, param.name) || undefined"
            :placeholder="
              param.defaultValue || t('configParamForm.selectPlaceholder')
            "
            class="w-full"
            @change="setValue(group.group, param.name, $event)"
          >
            <a-select-option
              v-for="opt in getOptions(param)"
              :key="opt.value"
              :value="opt.value"
            >
              {{ opt.title }}
            </a-select-option>
          </a-select>
          <!-- checkbox 类型 -->
          <a-checkbox-group
            v-else-if="param.type === 'checkbox'"
            :value="getCheckboxValue(group.group, param.name)"
            @change="setCheckboxValue(group.group, param.name, $event)"
          >
            <a-checkbox
              v-for="opt in getOptions(param)"
              :key="opt.value"
              :value="opt.value"
            >
              {{ opt.title }}
            </a-checkbox>
          </a-checkbox-group>
        </div>

        <div class="flex justify-start pt-1">
          <a-button
            type="primary"
            :loading="groupSaving[group.group]"
            @click="saveGroup(group)"
          >
            {{ t('configParamForm.save') }}
          </a-button>
        </div>
      </div>
    </a-collapse-panel>
  </a-collapse>
</template>

<style scoped></style>
