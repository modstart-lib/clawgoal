<script setup lang="ts">
import {
  userParamConfigForm,
  userParamGet,
  userParamSet,
  type ParamConfigGroup,
} from '@/api/userParam'
import {
  getGlobalMemory,
  getUserMemory,
  setGlobalMemory,
  setUserMemory,
} from '@/claw/api/memory'
import ConfigParamForm from '@/components/ConfigParamForm.vue'
import LoadingState from '@/components/LoadingState.vue'
import MarkdownFieldEditButton from '@/components/MarkdownFieldEditButton.vue'
import ConfigModelSelector from '@/views/Config/ConfigModelSelector.vue'
import { message } from 'ant-design-vue'
import { onMounted, onUnmounted, ref } from 'vue'
import { testActionSet, testActionUnset } from '@/utils/test'
import { useI18n } from 'vue-i18n'

const loading = ref(false)
const globalContent = ref('')
const content = ref('')
/** 与后端 getUserLang / LocaleKey 一致 */
const PARAM_USER_LANG = 'UserLang'
const language = ref<'zh-CN' | 'en-US'>('zh-CN')
const memoryModel = ref('')
const objectivePlanModel = ref('')

const { t } = useI18n()

// 工具参数配置（来自后端）
const toolsParamConfig = ref<ParamConfigGroup[]>([])

// 对话手风琴展开状态（默认展开）
const dialogExpanded = ref<string[]>(['dialog'])

onMounted(async () => {
  loading.value = true
  try {
    ;[
      globalContent.value,
      content.value,
      language.value,
      memoryModel.value,
      objectivePlanModel.value,
      toolsParamConfig.value,
    ] = await Promise.all([
      getGlobalMemory(),
      getUserMemory(),
      (async () => {
        let lang = await userParamGet(PARAM_USER_LANG, '')
        if (lang !== 'zh-CN' && lang !== 'en-US') {
          const legacy = await userParamGet('Language', '')
          if (legacy === 'zh') lang = 'zh-CN'
          else if (legacy === 'en') lang = 'en-US'
          else lang = 'zh-CN'
        }
        return lang as 'zh-CN' | 'en-US'
      })(),
      userParamGet('MemoryUpdateModel', ''),
      userParamGet('ObjectivePlanModel', ''),
      userParamConfigForm(),
    ])
  } finally {
    loading.value = false
  }
})

const handleGlobalContentChange = async (val: string) => {
  globalContent.value = val
  await setGlobalMemory(val)
  message.success(t('config.globalMemorySaved'))
}

const handleContentChange = async (val: string) => {
  content.value = val
  await setUserMemory(val)
  message.success(t('config.userMemorySaved'))
}

async function setLanguage(lang: 'zh-CN' | 'en-US') {
  language.value = lang
  await userParamSet(PARAM_USER_LANG, lang)
  message.success(t('config.languageSaved'))
}

async function setMemoryModel(val: string) {
  memoryModel.value = val
  await userParamSet('MemoryUpdateModel', val ?? '')
  message.success(t('config.memoryModelSaved'))
}

async function setObjectivePlanModel(val: string) {
  objectivePlanModel.value = val
  await userParamSet('ObjectivePlanModel', val ?? '')
  message.success(t('config.memoryModelSaved'))
}

onMounted(() => {
  testActionSet('config.chatSettings.setLanguage', () =>
    setLanguage(language.value === 'zh-CN' ? 'en-US' : 'zh-CN')
  )
})
onUnmounted(() => {
  testActionUnset('config.chatSettings.setLanguage')
})
</script>

<template>
  <div>
    <LoadingState :loading="loading">
      <div class="space-y-2">
        <!-- 对话配置手风琴 -->
        <a-collapse v-model:active-key="dialogExpanded" class="mb-4">
          <a-collapse-panel key="dialog" :header="t('config.chatSectionTitle')">
            <div class="space-y-6">
              <!-- 全局记忆 -->
              <div>
                <div
                  class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
                >
                  {{ t('config.globalMemoryTitle') }}
                </div>
                <div class="text-xs text-gray-400 dark:text-gray-500 mb-3">
                  {{ t('config.globalMemoryDesc') }}
                </div>
                <MarkdownFieldEditButton
                  :model-value="globalContent"
                  :placeholder="t('config.globalMemoryPlaceholder')"
                  @update:model-value="handleGlobalContentChange"
                />
              </div>

              <!-- 我的信息 -->
              <div>
                <div
                  class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
                >
                  {{ t('config.userMemoryTitle') }}
                </div>
                <div class="text-xs text-gray-400 dark:text-gray-500 mb-3">
                  {{ t('config.userMemoryDesc') }}
                </div>
                <MarkdownFieldEditButton
                  :model-value="content"
                  :placeholder="t('config.userMemoryPlaceholder')"
                  @update:model-value="handleContentChange"
                />
              </div>

              <!-- 对话语言 -->
              <div>
                <div
                  class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
                >
                  {{ t('config.chatLanguageTitle') }}
                </div>
                <div class="text-xs text-gray-400 dark:text-gray-500 mb-3">
                  {{ t('config.chatLanguageDesc') }}
                </div>
                <div class="flex gap-2">
                  <a-button
                    :type="language === 'zh-CN' ? 'primary' : 'default'"
                    @click="setLanguage('zh-CN')"
                  >
                    {{ t('config.chatLanguageZh') }}
                  </a-button>
                  <a-button
                    :type="language === 'en-US' ? 'primary' : 'default'"
                    @click="setLanguage('en-US')"
                  >
                    English
                  </a-button>
                </div>
              </div>

              <!-- 记忆更新模型 -->
              <div>
                <div
                  class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
                >
                  {{ t('config.memoryModelTitle') }}
                </div>
                <div class="text-xs text-gray-400 dark:text-gray-500 mb-3">
                  {{ t('config.memoryModelDesc') }}
                </div>
                <ConfigModelSelector
                  :value="memoryModel"
                  @update:value="setMemoryModel"
                />
              </div>

              <!-- 目标规划模型 -->
              <div>
                <div
                  class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
                >
                  {{ t('config.objectivePlanModelTitle') }}
                </div>
                <div class="text-xs text-gray-400 dark:text-gray-500 mb-3">
                  {{ t('config.objectivePlanModelDesc') }}
                </div>
                <ConfigModelSelector
                  :value="objectivePlanModel"
                  @update:value="setObjectivePlanModel"
                />
              </div>
            </div>
          </a-collapse-panel>
        </a-collapse>

        <!-- 工具参数配置（手风琴，每个 group 独立保存） -->
        <ConfigParamForm :param-config="toolsParamConfig" />
      </div>
    </LoadingState>
  </div>
</template>
