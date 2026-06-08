import { i18n } from '@/locale'
import type { WorkflowNodeDef } from '../../core/type'
import ViewComponent from './View.vue'
import ConfigComponent from './Config.vue'

export default {
  type: 'JsRunner',
  title: i18n.global.t('workflowNode.jsRunnerTitle'),
  icon: '⚡',
  description: i18n.global.t('workflowNode.jsRunnerDesc'),
  component: ViewComponent,
  configComponent: ConfigComponent,
  inputFields: [{ name: 'Value', type: 'text' as const }],
  outputFields: [{ name: 'Value', type: 'text' as const }],
} satisfies WorkflowNodeDef
