import { i18n } from '@/locale'
import type { WorkflowNodeDef } from '../../core/type'
import ViewComponent from './View.vue'
import ConfigComponent from './Config.vue'

export default {
  type: 'Variable',
  title: i18n.global.t('workflowNode.variableTitle'),
  icon: '📝',
  description: i18n.global.t('workflowNode.variableDesc'),
  component: ViewComponent,
  configComponent: ConfigComponent,
  inputFields: [],
  outputFields: [],
} satisfies WorkflowNodeDef
