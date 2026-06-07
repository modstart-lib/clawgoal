import officeEnUS from '../views/Office/locale/en-US'
import officeZhCN from '../views/Office/locale/zh-CN'
import agentEnUS from '../views/Agent/locale/en-US'
import agentZhCN from '../views/Agent/locale/zh-CN'
import cronEnUS from '../views/Cron/locale/en-US'
import cronZhCN from '../views/Cron/locale/zh-CN'
import taskEnUS from '../views/Task/locale/en-US'
import taskZhCN from '../views/Task/locale/zh-CN'
import objectiveEnUS from '../views/Objective/locale/en-US'
import objectiveZhCN from '../views/Objective/locale/zh-CN'
import projectEnUS from '../views/Project/locale/en-US'
import projectZhCN from '../views/Project/locale/zh-CN'
import resourceEnUS from '../views/Resource/locale/en-US'
import resourceZhCN from '../views/Resource/locale/zh-CN'
import backlogEnUS from '../views/Backlog/locale/en-US'
import backlogZhCN from '../views/Backlog/locale/zh-CN'
import eventEnUS from '../views/Event/locale/en-US'
import eventZhCN from '../views/Event/locale/zh-CN'
import shareEnUS from '../views/Share/locale/en-US'
import shareZhCN from '../views/Share/locale/zh-CN'
import noteEnUS from '../views/Note/locale/en-US'
import noteZhCN from '../views/Note/locale/zh-CN'
import wikiEnUS from '../views/Wiki/locale/en-US'
import wikiZhCN from '../views/Wiki/locale/zh-CN'
import metricEnUS from '../views/Metric/locale/en-US'
import metricZhCN from '../views/Metric/locale/zh-CN'
import configEnUS from '../views/Config/locale/en-US'
import configZhCN from '../views/Config/locale/zh-CN'
import settingEnUS from '../views/Setting/locale/en-US'
import settingZhCN from '../views/Setting/locale/zh-CN'

export const useClawLocales = () => ({
  zhCN: {
    'agentSelector.placeholder': '选择智能体',
    'claw.agent.settingsTitle': '设置',
    'claw.compAgentList.statusIdle': '空闲',
    'claw.compAgentList.statusWorking': '工作中',
    'claw.compAgentList.systemBuiltin': '系统内置',
    'claw.compAuditDiffViewer.noChanges': '暂无变更',
    'claw.compAuditDiffViewer.noChangesContent': '没有检测到代码差异',
    'claw.compAuditDiffViewer.noDiff': '暂无差异',
    'claw.compAuditViewModal.approve': '通过',
    'claw.compAuditViewModal.cancelMerge': '取消合并',
    'claw.compAuditViewModal.loadFailed': '加载失败',
    'claw.compAuditViewModal.reject': '拒绝',
    'claw.compAuditViewModal.rejectPlaceholder': '请输入拒绝原因',
    'claw.compAuditViewModal.statusApproved': '已通过',
    'claw.compAuditViewModal.statusCancelled': '已取消',
    'claw.compAuditViewModal.statusPending': '待处理',
    'claw.compAuditViewModal.statusRejected': '已拒绝',
    'claw.compAuditViewModal.title': '审核详情',
    'claw.compChannelSelector.disabled': '已禁用',
    'claw.compChannelSelector.placeholder': '选择消息渠道',
    'claw.compChannelSelector.typeDingtalk': '钉钉',
    'claw.compChannelSelector.typeDiscord': 'Discord',
    'claw.compChannelSelector.typeFeishu': '飞书',
    'claw.compChannelSelector.typeLine': 'LINE',
    'claw.compChannelSelector.typeMatrix': 'Matrix',
    'claw.compChannelSelector.typeMattermost': 'Mattermost',
    'claw.compChannelSelector.typeMsteams': 'Microsoft Teams',
    'claw.compChannelSelector.typeSlack': 'Slack',
    'claw.compChannelSelector.typeTelegram': 'Telegram',
    'claw.compChannelSelector.typeWecom': '企业微信',
    'claw.compChannelViewer.empty': '未选择渠道',
    'claw.compProjectMultiSelector.placeholder': '选择项目',
    'claw.compProjectSelector.placeholder': '选择项目',
    'claw.compTextTemplateSelector.selectTemplate': '选择模板',
    'claw.objective.statusCanceled': '已取消',
    'claw.project.saveFailed': '保存失败',
    'claw.nav.office': '工作空间',
    'claw.nav.agent': '智能体',
    'claw.nav.project': '项目',
    'claw.nav.cron': '定时任务',
    'claw.nav.resource': '资源',
    'claw.nav.channel': '消息渠道',
    'claw.home.clawDescription': 'AI Agent 工作台，管理智能体、计划与项目',
    'claw.common.copyIdTooltip': '点击复制 ID',
    'claw.routerTitleNoteShare': '笔记分享',
    'claw.routerTitleEventShare': '事件分享',
    'claw.routerTitleOffice': '办公空间',
    'claw.routerTitleProject': '项目',
    'claw.routerTitleProjectDetail': '项目详情',
    'claw.routerTitleAgent': '智能体',
    'claw.routerTitleAgentDetail': '智能体详情',
    'claw.routerTitleResource': '资源',
    'claw.routerTitleCron': '定时任务',
    'claw.routerTitleSettings': '设置',
    'claw.routerTitleFeatureSettings': '功能设置',
    ...officeZhCN,
    ...agentZhCN,
    ...cronZhCN,
    ...taskZhCN,
    ...objectiveZhCN,
    ...projectZhCN,
    ...resourceZhCN,
    ...backlogZhCN,
    ...eventZhCN,
    ...shareZhCN,
    ...noteZhCN,
    ...wikiZhCN,
    ...metricZhCN,
    ...configZhCN,
    ...settingZhCN,
  },
  enUS: {
    'agentSelector.placeholder': 'Select agent',
    'claw.agent.settingsTitle': 'Settings',
    'claw.compAgentList.statusIdle': 'Idle',
    'claw.compAgentList.statusWorking': 'Working',
    'claw.compAgentList.systemBuiltin': 'System built-in',
    'claw.compAuditDiffViewer.noChanges': 'No changes',
    'claw.compAuditDiffViewer.noChangesContent': 'No code differences detected',
    'claw.compAuditDiffViewer.noDiff': 'No diff',
    'claw.compAuditViewModal.approve': 'Approve',
    'claw.compAuditViewModal.cancelMerge': 'Cancel merge',
    'claw.compAuditViewModal.loadFailed': 'Load Failed',
    'claw.compAuditViewModal.reject': 'Reject',
    'claw.compAuditViewModal.rejectPlaceholder': 'Enter rejection reason',
    'claw.compAuditViewModal.statusApproved': 'Approved',
    'claw.compAuditViewModal.statusCancelled': 'Cancelled',
    'claw.compAuditViewModal.statusPending': 'Pending',
    'claw.compAuditViewModal.statusRejected': 'Rejected',
    'claw.compAuditViewModal.title': 'Audit details',
    'claw.compChannelSelector.disabled': 'Disabled',
    'claw.compChannelSelector.placeholder': 'Select message channel',
    'claw.compChannelSelector.typeDingtalk': 'DingTalk',
    'claw.compChannelSelector.typeDiscord': 'Discord',
    'claw.compChannelSelector.typeFeishu': 'Feishu',
    'claw.compChannelSelector.typeLine': 'LINE',
    'claw.compChannelSelector.typeMatrix': 'Matrix',
    'claw.compChannelSelector.typeMattermost': 'Mattermost',
    'claw.compChannelSelector.typeMsteams': 'Microsoft Teams',
    'claw.compChannelSelector.typeSlack': 'Slack',
    'claw.compChannelSelector.typeTelegram': 'Telegram',
    'claw.compChannelSelector.typeWecom': 'WeCom',
    'claw.compChannelViewer.empty': 'No channel selected',
    'claw.compProjectMultiSelector.placeholder': 'Select project',
    'claw.compProjectSelector.placeholder': 'Select project',
    'claw.compTextTemplateSelector.selectTemplate': 'Select template',
    'claw.objective.statusCanceled': 'Canceled',
    'claw.project.saveFailed': 'Save Failed',
    'claw.nav.office': 'Office',
    'claw.nav.agent': 'My Agents',
    'claw.nav.project': 'Projects',
    'claw.nav.cron': 'Cron',
    'claw.nav.resource': 'Resources',
    'claw.nav.channel': 'Channel',
    'claw.home.clawDescription':
      'AI Agent workspace for managing agents, plans & projects',
    'claw.common.copyIdTooltip': 'Click to copy ID',
    'claw.routerTitleNoteShare': 'Note Share',
    'claw.routerTitleEventShare': 'Event Share',
    'claw.routerTitleOffice': 'Office',
    'claw.routerTitleProject': 'Project',
    'claw.routerTitleProjectDetail': 'Project Detail',
    'claw.routerTitleAgent': 'Agent',
    'claw.routerTitleAgentDetail': 'Agent Detail',
    'claw.routerTitleResource': 'Resource',
    'claw.routerTitleCron': 'Cron Tasks',
    'claw.routerTitleSettings': 'Settings',
    'claw.routerTitleFeatureSettings': 'Feature Settings',
    ...officeEnUS,
    ...agentEnUS,
    ...cronEnUS,
    ...taskEnUS,
    ...objectiveEnUS,
    ...projectEnUS,
    ...resourceEnUS,
    ...backlogEnUS,
    ...eventEnUS,
    ...shareEnUS,
    ...noteEnUS,
    ...wikiEnUS,
    ...metricEnUS,
    ...configEnUS,
    ...settingEnUS,
  },
})
