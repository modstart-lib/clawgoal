import { i18n } from '@/locale'
import type { WorkflowNodeDef } from '../../core/type'
import ViewComponent from './View.vue'
import ConfigComponent from './Config.vue'

export default {
  type: 'FileCopy',
  title: i18n.global.t('workflowNode.fileCopyTitle'),
  icon: '📋',
  description: i18n.global.t('workflowNode.fileCopyDesc'),
  component: ViewComponent,
  configComponent: ConfigComponent,
  inputFields: [
    { name: 'Src', type: 'text' as const },
    { name: 'Dest', type: 'text' as const },
  ],
  outputFields: [{ name: 'File', type: 'text' as const }],
} satisfies WorkflowNodeDef
