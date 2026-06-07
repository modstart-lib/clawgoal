import type { RouteRecordRaw } from 'vue-router'

export const useClawPublicRoutes = (): RouteRecordRaw[] => [
  {
    path: '/claw/note/share/:idHash',
    name: 'NoteShare',
    component: () => import('@/claw/views/Share/NoteShare.vue'),
    meta: { title: 'claw.routerTitleNoteShare', public: true },
  },
  {
    path: '/claw/event/share/:idHash',
    name: 'EventShare',
    component: () => import('@/claw/views/Share/EventShare.vue'),
    meta: { title: 'claw.routerTitleEventShare', public: true },
  },
]

export const useClawRoutes = (): RouteRecordRaw[] => [
  {
    path: 'claw',
    redirect: '/claw/office',
  },
  {
    path: 'claw/office',
    name: 'Office',
    component: () => import('@/claw/views/Office.vue'),
    meta: { title: 'claw.routerTitleOffice', fullscreen: true },
  },
  {
    path: 'claw/project',
    name: 'Project',
    component: () => import('@/claw/views/Project.vue'),
    meta: { title: 'claw.routerTitleProject' },
  },
  {
    path: 'claw/project/:id',
    name: 'ProjectDetail',
    component: () => import('@/claw/views/Project/ProjectDetail.vue'),
    meta: { title: 'claw.routerTitleProjectDetail' },
  },
  {
    path: 'claw/objectiveTask',
    redirect: '/claw/project',
  },
  {
    path: 'claw/agent',
    name: 'Agent',
    component: () => import('@/claw/views/Agent.vue'),
    meta: { title: 'claw.routerTitleAgent' },
  },
  {
    path: 'claw/agent/:id',
    name: 'AgentDetail',
    component: () => import('@/claw/views/Agent/AgentDetail.vue'),
    meta: { title: 'claw.routerTitleAgentDetail', fullscreen: true },
  },
  {
    path: 'claw/resource',
    name: 'Resource',
    component: () => import('@/claw/views/Resource.vue'),
    meta: { title: 'claw.routerTitleResource' },
  },
  {
    path: 'claw/cron',
    name: 'Cron',
    component: () => import('@/claw/views/Cron.vue'),
    meta: { title: 'claw.routerTitleCron' },
  },
  {
    path: 'claw/setting',
    name: 'ClawSetting',
    component: () => import('../views/Setting.vue'),
    meta: { title: 'claw.routerTitleSettings' },
  },
  {
    path: 'claw/config',
    name: 'Config',
    component: () => import('@/claw/views/Config.vue'),
    meta: { title: 'claw.routerTitleFeatureSettings' },
  },
]
