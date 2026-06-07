import { i18n } from '@/locale'
import type { WorkflowNodeDef } from '../../core/type'
import ViewComponent from './View.vue'
import ConfigComponent from './Config.vue'

export default {
  type: 'McpToolsCall',
  title: i18n.global.t('workflowNode.mcpToolsCallTitle'),
  icon: '🔧',
  description: i18n.global.t('workflowNode.mcpToolsCallDesc'),
  component: ViewComponent,
  configComponent: ConfigComponent,
  inputFields: [],
  outputFields: [{ name: 'Result', type: 'text' as const }],
} satisfies WorkflowNodeDef
