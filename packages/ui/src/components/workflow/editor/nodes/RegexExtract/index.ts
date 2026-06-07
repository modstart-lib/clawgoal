import { i18n } from '@/locale'
import type { WorkflowNodeDef } from '../../core/type'
import ViewComponent from './View.vue'
import ConfigComponent from './Config.vue'

export default {
  type: 'RegexExtract',
  title: i18n.global.t('workflowNode.regexExtractTitle'),
  icon: '🔍',
  description: i18n.global.t('workflowNode.regexExtractDesc'),
  component: ViewComponent,
  configComponent: ConfigComponent,
  inputFields: [{ name: 'Value', type: 'text' as const }],
  outputFields: [{ name: 'Value', type: 'text' as const }],
} satisfies WorkflowNodeDef
