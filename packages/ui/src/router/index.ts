import {
  useClawRoutes,
  useClawPublicRoutes,
} from '../../../ui-claw/src/router/index.ts'
import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'
import MainLayout from '../MainLayout.vue'
import { useAuth } from '../composables/auth.ts'
import { systemApi } from '../api/system'

import { useAppEnv } from '@/composables/setting.ts'
import LoginView from '../views/Login.vue'

/**
 * Wrap module routes with MainLayout, stripping the module prefix from each child path.
 * Example: useFinderRoutes returns ['finder','finder/setting'].
 *   layoutModule('/finder', routes) → { path:'finder', component:MainLayout,
 *     children: [ { path:'' }, { path:'setting' } ] }
 *   Full URLs: /finder, /finder/setting — unchanged from before.
 */
function layoutModule(
  modulePath: string,
  moduleRoutes: RouteRecordRaw[]
): RouteRecordRaw {
  // Ensure modulePath starts with / (it's a top-level route)
  const topPath = modulePath.startsWith('/') ? modulePath : '/' + modulePath
  const prefix = topPath.slice(1) // strip leading / for child path comparison
  return {
    path: topPath,
    component: MainLayout,
    children: moduleRoutes.map((r) => ({
      ...r,
      path: r.path.startsWith(prefix + '/')
        ? r.path.slice(prefix.length).replace(/^\//, '')
        : r.path === prefix
          ? ''
          : r.path,
    })),
  }
}

const routes: RouteRecordRaw[] = [
  {
    path: '/login',
    name: 'Login',
    component: LoginView,
    meta: { title: 'Login' },
  },
  ...useClawPublicRoutes(),

  // ── Each module gets its own route with MainLayout ──
  layoutModule('/claw', useClawRoutes()),

  // Default: redirect to last active module's home, or first module
  {
    path: '/',
    redirect: () => {
      const lastType = localStorage.getItem('clawgoal_sidebar_active_type')
      if (lastType) return '/' + lastType
      // Fallback: first top-level module route (single segment, no params)
      const routes = router?.getRoutes?.()
      if (routes) {
        const r = routes.find(
          (r) =>
            /^\/[a-z]+$/.test(r.path) &&
            !['/', '/login', '/home'].includes(r.path)
        )
        if (r) return r.path
      }
      return '/finder'
    },
  },
  { path: '/home', redirect: '/' },

  // 404 catch-all (outside of any layout)
  {
    path: '/:pathMatch(.*)*',
    name: 'NotFound',
    component: () => import('../views/NotFound.vue'),
    meta: { title: '404' },
  },
]

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
})

router.beforeEach(async (to, _from) => {
  // 页面访问统计（fire and forget）
  systemApi.collect('visit', { path: to.path }).catch(() => {})

  // 公开页面无需认证
  if (to.meta?.public) {
    return
  }

  const authStore = useAuth()
  const appEnv = useAppEnv()

  console.log(
    `[DIAG:guard] path=${to.path} isAuth=${authStore.isAuthenticated} isInit=${authStore.isInitialized} viewMode=${appEnv.serverViewMode}`
  )

  if (!authStore.isAuthenticated && !authStore.isInitialized) {
    console.log(
      `[DIAG:guard] calling autoLogin(viewMode=${appEnv.serverViewMode})...`
    )
    const result = await authStore.autoLogin(appEnv.serverViewMode)
    console.log(
      `[DIAG:guard] autoLogin result=${result} isAuth=${authStore.isAuthenticated} isInit=${authStore.isInitialized}`
    )
  }

  if (authStore.isAuthenticated) {
    console.log(`[DIAG:guard] calling fetchBasic()...`)
    await appEnv.fetchBasic()
    console.log(
      `[DIAG:guard] fetchBasic done viewMode=${appEnv.serverViewMode}`
    )
  }

  if (to.path === '/login' && authStore.isAuthenticated) {
    console.log(`[DIAG:guard] redirect /login → / (authenticated)`)
    return '/'
  }

  if (to.path !== '/login' && !authStore.isAuthenticated) {
    console.log(`[DIAG:guard] redirect ${to.path} → /login (not authenticated)`)
    return '/login'
  }

  console.log(`[DIAG:guard] proceed to ${to.path}`)
  return
})

export default router
