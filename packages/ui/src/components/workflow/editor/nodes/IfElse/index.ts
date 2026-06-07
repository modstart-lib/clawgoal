import { i18n } from '@/locale'
import type { WorkflowNodeDef } from '../../core/type'
import ViewComponent from './View.vue'
import ConfigComponent from './Config.vue'

export default {
  type: 'IfElse',
  title: i18n.global.t('workflowNode.ifElseTitle'),
  icon: '🔀',
  description: i18n.global.t('workflowNode.ifElseDesc'),
  component: ViewComponent,
  configComponent: ConfigComponent,
  inputFields: [],
  outputFields: [],
} satisfies WorkflowNodeDef
