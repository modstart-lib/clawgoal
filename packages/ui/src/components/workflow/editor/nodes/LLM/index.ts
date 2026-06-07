import { i18n } from '@/locale'
import type { WorkflowNodeDef } from '../../core/type'
import ViewComponent from './View.vue'
import ConfigComponent from './Config.vue'

export default {
  type: 'LLM',
  title: i18n.global.t('workflowNode.llmTitle'),
  icon: '🤖',
  description: i18n.global.t('workflowNode.llmDesc'),
  component: ViewComponent,
  configComponent: ConfigComponent,
  inputFields: [{ name: 'Prompt', type: 'textarea' as const }],
  outputFields: [
    { name: 'Text', type: 'text' as const },
    { name: 'Json', type: 'json' as const },
  ],
} satisfies WorkflowNodeDef
