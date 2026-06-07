import { i18n } from '@/locale'
import type { WorkflowNodeDef } from '../../core/type'
import ViewComponent from './View.vue'
import ConfigComponent from './Config.vue'

export default {
  type: 'FunctionCall',
  title: i18n.global.t('workflowNode.functionCallTitle'),
  icon: '📞',
  description: i18n.global.t('workflowNode.functionCallDesc'),
  component: ViewComponent,
  configComponent: ConfigComponent,
  inputFields: [],
  outputFields: [],
} satisfies WorkflowNodeDef
