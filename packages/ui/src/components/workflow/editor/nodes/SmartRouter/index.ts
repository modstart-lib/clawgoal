import { i18n } from '@/locale'
import type { WorkflowNodeDef } from '../../core/type'
import ViewComponent from './View.vue'
import ConfigComponent from './Config.vue'

export default {
  type: 'SmartRouter',
  title: i18n.global.t('workflowNode.smartRouterTitle'),
  icon: 'navigation',
  description: i18n.global.t('workflowNode.smartRouterDesc'),
  component: ViewComponent,
  configComponent: ConfigComponent,
  inputFields: [{ name: 'Input', type: 'textarea' as const }],
  outputFields: [],
} satisfies WorkflowNodeDef
