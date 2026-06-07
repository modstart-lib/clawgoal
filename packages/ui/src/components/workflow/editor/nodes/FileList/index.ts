import { i18n } from '@/locale'
import type { WorkflowNodeDef } from '../../core/type'
import ViewComponent from './View.vue'
import ConfigComponent from './Config.vue'

export default {
  type: 'FileList',
  title: i18n.global.t('workflowNode.fileListTitle'),
  icon: '📂',
  description: i18n.global.t('workflowNode.fileListDesc'),
  component: ViewComponent,
  configComponent: ConfigComponent,
  inputFields: [{ name: 'Dir', type: 'text' as const }],
  outputFields: [{ name: 'Files', type: 'text' as const }],
} satisfies WorkflowNodeDef
