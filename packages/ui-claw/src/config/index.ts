import BarChart2 from '~icons/lucide/bar-chart-2'
import Box from '~icons/lucide/box'
import Building2 from '~icons/lucide/building-2'
import FolderKanban from '~icons/lucide/folder-kanban'
import SlidersHorizontal from '~icons/lucide/sliders-horizontal'
import Timer from '~icons/lucide/timer'
import Users from '~icons/lucide/users'
export const getClawMenuItems = (t: (key: string) => string) => [
  { key: 'office', label: t('claw.nav.office'), icon: Building2 },
  { key: 'agent', label: t('claw.nav.agent'), icon: Users },
  { key: 'project', label: t('claw.nav.project'), icon: FolderKanban },
  { key: 'cron', label: t('claw.nav.cron'), icon: Timer },
  { key: 'resource', label: t('claw.nav.resource'), icon: Box },
  { key: 'config', label: t('config.title'), icon: SlidersHorizontal },
]

export const clawRouteMap: Record<string, string> = {
  office: '/claw/office',
  agent: '/claw/agent',
  project: '/claw/project',
  cron: '/claw/cron',
  resource: '/claw/resource',
  config: '/claw/config',
}

export const useClaw = () => ({
  key: 'claw' as const,
  label: 'Claw',
  homePath: '/claw/office',
  pathPrefix: '/claw',
  settingPath: '/claw/setting',
  getMenuItems: getClawMenuItems,
  routeMap: clawRouteMap,
  getActiveKey: (routeName: string): string | null => {
    if (routeName.includes('Office')) return 'office'
    if (routeName.includes('Project')) return 'project'
    if (routeName.includes('Agent')) return 'agent'
    if (routeName.includes('Resource')) return 'resource'
    if (routeName.includes('Cron')) return 'cron'
    if (routeName.includes('Settings')) return 'setting'
    if (routeName.includes('Config') || routeName.includes('Channel'))
      return 'config'
    return null
  },
  homeMode: {
    key: 'claw',
    icon: BarChart2,
    title: 'Claw',
    descriptionKey: 'claw.home.clawDescription',
    path: '/claw/office',
    color: 'text-violet-500',
    bg: 'bg-violet-50 dark:bg-violet-900/20',
    border: 'hover:border-violet-300 dark:hover:border-violet-600',
    ring: 'hover:ring-violet-100 dark:hover:ring-violet-900/30',
  },
})
