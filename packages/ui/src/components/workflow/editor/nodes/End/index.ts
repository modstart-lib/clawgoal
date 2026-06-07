import { i18n } from '@/locale'
import type { WorkflowNodeDef } from '../../core/type'
import ViewComponent from './View.vue'

export default {
  type: 'End',
  title: i18n.global.t('workflowNode.endTitle'),
  icon: '🏁',
  description: i18n.global.t('workflowNode.endDesc'),
  component: ViewComponent,
  configComponent: null as any,
  inputFields: [],
  outputFields: [],
} satisfies WorkflowNodeDef
