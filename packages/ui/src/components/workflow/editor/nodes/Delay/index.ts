import { i18n } from '@/locale'
import type { WorkflowNodeDef } from '../../core/type'
import ViewComponent from './View.vue'
import ConfigComponent from './Config.vue'
import Timer from '~icons/lucide/timer'

export default {
  type: 'Delay',
  title: i18n.global.t('workflowNode.delayTitle'),
  icon: Timer,
  description: i18n.global.t('workflowNode.delayDesc'),
  component: ViewComponent,
  configComponent: ConfigComponent,
  inputFields: [],
  outputFields: [],
} satisfies WorkflowNodeDef
