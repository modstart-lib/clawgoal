<script setup lang="ts">
import { message } from 'ant-design-vue'
import { reactive, ref, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import CaptchaSlider from '../components/CaptchaSlider.vue'
import { useAuth } from '../composables/auth.ts'

const authStore = useAuth()
const { t } = useI18n()
const router = useRouter()

const formState = reactive({
  username: '',
  password: '',
})

const loading = ref(false)
const captchaToken = ref('')
const captchaRef = ref<{ reset: () => void } | null>(null)
let autoLoginTimer: ReturnType<typeof setTimeout> | null = null

function clearAutoLoginTimer() {
  if (autoLoginTimer) {
    clearTimeout(autoLoginTimer)
    autoLoginTimer = null
  }
}

onUnmounted(() => {
  clearAutoLoginTimer()
})

function resetCaptcha() {
  captchaToken.value = ''
  captchaRef.value?.reset()
  clearAutoLoginTimer()
}

function onCaptchaVerified(verifiedToken: string) {
  captchaToken.value = verifiedToken
  if (verifiedToken && formState.username && formState.password) {
    autoLoginTimer = setTimeout(() => {
      autoLoginTimer = null
      onFinish(formState)
    }, 500)
  }
}

const onFinish = async (values: any) => {
  if (!captchaToken.value) {
    message.warning(t('login.captchaRequired'))
    return
  }

  loading.value = true

  const result = await authStore.login(
    values.username,
    values.password,
    captchaToken.value
  )

  if (result.success) {
    // 不在导航前修改任何响应式状态，避免 Vue 同时"重渲染 Login"和"卸载 Login(路由切换)"
    // 导致 RouterView anchor 节点冲突引发 insertBefore 报错
    await router.push('/')
    // 若导航失败（返回 NavigationFailure），组件仍挂载，需重置 loading
    loading.value = false
  } else {
    loading.value = false
    message.error(result.message || t('auth.loginFailed'))
    resetCaptcha()
  }
}

const onFinishFailed = (errorInfo: any) => {
  console.log('Failed:', errorInfo)
}
</script>

<template>
  <div
    class="relative min-h-screen flex items-center justify-center overflow-hidden bg-surface dark:bg-panel transition-colors duration-300"
  >
    <!-- Premium Ambient Background Decor -->
    <div
      class="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] rounded-full bg-gradient-to-br from-primary/30 to-primary-hover/30 dark:from-primary/20 dark:to-primary-hover/20 blur-[80px] animate-float opacity-70 pointer-events-none"
    ></div>
    <div
      class="absolute bottom-[-10%] right-[-10%] w-[400px] h-[400px] rounded-full bg-gradient-to-tr from-primary/30 to-primary-hover/30 dark:from-primary/20 dark:to-primary-hover/20 blur-[80px] animate-float animation-delay-2000 opacity-70 pointer-events-none"
    ></div>
    <div
      class="absolute top-[20%] right-[10%] w-[300px] h-[300px] rounded-full bg-gradient-to-br from-accent/20 to-primary/20 dark:from-accent/10 dark:to-primary/10 blur-[80px] animate-float animation-delay-4000 opacity-70 pointer-events-none"
    ></div>

    <!-- Subtle Grid Overlay -->
    <div
      class="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMiIgY3k9IjIiIHI9IjEiIGZpbGw9InJnYmEoMTcxLCAxNzEsIDE3MSwgMC4yKSIvPjwvc3ZnPg==')] [mask-image:linear-gradient(to_bottom,white,transparent)] pointer-events-none opacity-50 dark:opacity-30"
    ></div>

    <!-- Glassmorphism Container -->
    <div
      class="relative z-10 w-full p-8 sm:p-10 mx-4 backdrop-blur-2xl bg-surface/40 dark:bg-panel/40 border border-white/60 dark:border-white/10 rounded-[2rem] shadow-[0_8px_32px_rgba(0,0,0,0.08)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.4)] transition-all duration-300"
      style="max-width: 400px"
    >
      <!-- Title Area -->
      <div class="text-center mb-10">
        <h2
          class="text-3xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-gray-900 to-gray-600 dark:from-white dark:to-gray-300 tracking-tight"
        >
          ClawGoal
        </h2>
        <p class="text-sm font-medium text-gray-500 dark:text-gray-400 mt-2">
          Agents Go for Goals
        </p>
      </div>
      <a-form
        :model="formState"
        name="basic"
        autocomplete="off"
        @finish="onFinish"
        @finish-failed="onFinishFailed"
      >
        <a-form-item
          name="username"
          :rules="[{ required: true, message: $t('auth.usernameRequired') }]"
        >
          <a-input
            v-model:value="formState.username"
            size="large"
            :placeholder="$t('auth.username')"
            autocomplete="username"
          />
        </a-form-item>

        <a-form-item
          name="password"
          :rules="[{ required: true, message: $t('auth.passwordRequired') }]"
        >
          <a-input-password
            v-model:value="formState.password"
            size="large"
            :placeholder="$t('auth.password')"
            autocomplete="current-password"
          />
        </a-form-item>

        <a-form-item>
          <CaptchaSlider ref="captchaRef" @verified="onCaptchaVerified" />
        </a-form-item>

        <a-form-item>
          <a-button
            type="primary"
            html-type="submit"
            size="large"
            class="w-full"
            :loading="loading"
          >
            {{ $t('auth.login') }}
          </a-button>
        </a-form-item>
      </a-form>
    </div>
  </div>
</template>

<style scoped>
@keyframes float {
  0% {
    transform: translate(0px, 0px) scale(1);
  }
  33% {
    transform: translate(30px, -50px) scale(1.1);
  }
  66% {
    transform: translate(-20px, 20px) scale(0.9);
  }
  100% {
    transform: translate(0px, 0px) scale(1);
  }
}
.animate-float {
  animation: float 10s infinite alternate ease-in-out;
}
.animation-delay-2000 {
  animation-delay: 2s;
}
.animation-delay-4000 {
  animation-delay: 4s;
}

/* Adjust ant-design form inputs slightly to match premium feel */
:deep(.ant-input),
:deep(.ant-input-password) {
  background-color: rgba(255, 255, 255, 0.5) !important;
  border-color: rgba(0, 0, 0, 0.1) !important;
  backdrop-filter: blur(8px);
  transition: all 0.3s;
}
:deep(.ant-input:focus),
:deep(.ant-input-password:focus),
:deep(.ant-input-focused) {
  background-color: rgba(255, 255, 255, 0.8) !important;
  border-color: #6366f1 !important;
  box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.2) !important;
}

.dark :deep(.ant-input),
.dark :deep(.ant-input-password) {
  background-color: rgba(0, 0, 0, 0.2) !important;
  border-color: rgba(255, 255, 255, 0.1) !important;
  color: #fff !important;
}
.dark :deep(.ant-input:focus),
.dark :deep(.ant-input-password:focus),
.dark :deep(.ant-input-focused) {
  background-color: rgba(0, 0, 0, 0.4) !important;
  border-color: #818cf8 !important;
  box-shadow: 0 0 0 2px rgba(129, 140, 248, 0.2) !important;
}
.dark :deep(.ant-input-password-icon) {
  color: rgba(255, 255, 255, 0.5) !important;
}
.dark :deep(.ant-input::-webkit-input-placeholder) {
  color: rgba(255, 255, 255, 0.3) !important;
}

:deep(.ant-btn-primary[disabled]) {
  background: rgba(0, 0, 0, 0.04) !important;
  box-shadow: none !important;
  color: rgba(0, 0, 0, 0.25) !important;
}
.dark :deep(.ant-btn-primary[disabled]) {
  background: rgba(255, 255, 255, 0.08) !important;
  color: rgba(255, 255, 255, 0.3) !important;
}
</style>
