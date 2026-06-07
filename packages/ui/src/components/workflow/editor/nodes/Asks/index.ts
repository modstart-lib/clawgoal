import { i18n } from '@/locale'
import type { WorkflowNodeDef } from '../../core/type'
import ViewComponent from './View.vue'
import ConfigComponent from './Config.vue'

export default {
  type: 'Asks',
  title: i18n.global.t('workflowNode.asksTitle'),
  icon: '❓',
  description: i18n.global.t('workflowNode.asksDesc'),
  component: ViewComponent,
  configComponent: ConfigComponent,
  inputFields: [],
  outputFields: [],
} satisfies WorkflowNodeDef
