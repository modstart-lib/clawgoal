import { i18n } from '@/locale'
import type { WorkflowNodeDef } from '../../core/type'
import ViewComponent from './View.vue'
import ConfigComponent from './Config.vue'

export default {
  type: 'Start',
  title: i18n.global.t('workflowNode.startTitle'),
  icon: '🚀',
  description: i18n.global.t('workflowNode.startDesc'),
  component: ViewComponent,
  configComponent: ConfigComponent,
  inputFields: [],
  outputFields: [],
} satisfies WorkflowNodeDef
