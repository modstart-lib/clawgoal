import { i18n } from '@/locale'
import type { WorkflowNodeDef } from '../../core/type'
import ViewComponent from './View.vue'
import ConfigComponent from './Config.vue'

export default {
  type: 'RandomValue',
  title: i18n.global.t('workflowNode.randomValueTitle'),
  icon: '🎲',
  description: i18n.global.t('workflowNode.randomValueDesc'),
  component: ViewComponent,
  configComponent: ConfigComponent,
  inputFields: [],
  outputFields: [{ name: 'Value', type: 'text' as const }],
} satisfies WorkflowNodeDef
