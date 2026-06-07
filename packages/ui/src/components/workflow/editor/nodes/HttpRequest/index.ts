import { i18n } from '@/locale'
import type { WorkflowNodeDef } from '../../core/type'
import ViewComponent from './View.vue'
import ConfigComponent from './Config.vue'

export default {
  type: 'HttpRequest',
  title: i18n.global.t('workflowNode.httpRequestTitle'),
  icon: '🌐',
  description: i18n.global.t('workflowNode.httpRequestDesc'),
  component: ViewComponent,
  configComponent: ConfigComponent,
  inputFields: [],
  outputFields: [
    { name: 'Body', type: 'text' as const },
    { name: 'Status', type: 'text' as const },
  ],
} satisfies WorkflowNodeDef
