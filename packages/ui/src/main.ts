import Antd from 'ant-design-vue'
import dayjs from 'dayjs'
import localeData from 'dayjs/plugin/localeData'
import weekday from 'dayjs/plugin/weekday'
import { createApp } from 'vue'
import App from './App.vue'
import i18n from './locale'
import router from './router'
import { pinia } from './stores/pinia'
import './assets/main.css'
import { waitForBackendPingInDev } from './utils/waitBackendPing'
import { initErrorReporter } from './utils/errorReporter'
import { initTestRegistry, registerNavigate } from './utils/test'
import { useAuth } from './composables/auth.ts'
import { useAppEnv } from './composables/setting.ts'

dayjs.extend(weekday)
dayjs.extend(localeData)

initErrorReporter()

await waitForBackendPingInDev()

const app = createApp(App)

app.use(pinia)
app.use(Antd)
app.use(i18n)

// Fetch viewMode first to decide whether auto-login is needed.
// Only IS_CLIENT mode (viewMode='client') supports auto-login without credentials.
// IMPORTANT: Must be called BEFORE app.use(router) so the router guard
// can read the viewMode from the same Pinia store.
const authStore = useAuth()
const envStore = useAppEnv()
await envStore.fetchBasic()
if (envStore.serverViewMode === 'client') {
  try {
    await authStore.tryAutoLogin()
  } catch (err) {
    console.warn('[main] tryAutoLogin failed:', err)
  }
}

app.use(router)

// Wait for the initial navigation to complete (including auth guard and potential
// redirect to /login) before mounting the app. This prevents a flash of protected
// page content when the user is not authenticated.
await router.isReady()


app.mount('#app')
