<template>
  <div class="max-w-lg pt-2 space-y-8">
    <!-- Change Username -->
    <div>
      <div
        class="text-base font-semibold text-gray-900 dark:text-gray-100 mb-4"
      >
        {{ $t('setting.changeUsername') }}
      </div>
      <a-form layout="vertical">
        <a-form-item :label="$t('setting.currentUsername')">
          <a-input :value="currentUsername" disabled />
        </a-form-item>
        <a-form-item :label="$t('setting.newUsername')" required>
          <a-input
            v-model:value="usernameForm.newUsername"
            :placeholder="$t('setting.newUsernamePlaceholder')"
          />
        </a-form-item>
        <a-form-item>
          <a-button
            type="primary"
            :disabled="!usernameDirty"
            @click="handleUpdateUsername"
            >{{ $t('setting.updateUsernameBtn') }}</a-button
          >
        </a-form-item>
      </a-form>
    </div>

    <!-- Change Password -->
    <div>
      <div
        class="text-base font-semibold text-gray-900 dark:text-gray-100 mb-4"
      >
        {{ $t('setting.changePassword') }}
      </div>
      <a-form layout="vertical" :model="passwordForm">
        <a-form-item :label="$t('setting.currentPassword')" required>
          <a-input-password
            v-model:value="passwordForm.oldPassword"
            :placeholder="$t('setting.currentPasswordPlaceholder')"
            autocomplete="current-password"
          />
        </a-form-item>
        <a-form-item :label="$t('setting.newPassword')" required>
          <a-input-password
            v-model:value="passwordForm.newPassword"
            :placeholder="$t('setting.newPasswordPlaceholder')"
            autocomplete="new-password"
          />
        </a-form-item>
        <a-form-item :label="$t('setting.confirmNewPassword')" required>
          <a-input-password
            v-model:value="passwordForm.confirmPassword"
            :placeholder="$t('setting.confirmNewPasswordPlaceholder')"
            autocomplete="new-password"
          />
        </a-form-item>
        <a-form-item>
          <a-button
            type="primary"
            :disabled="!passwordDirty"
            @click="handleUpdatePassword"
            >{{ $t('setting.updatePasswordBtn') }}</a-button
          >
        </a-form-item>
      </a-form>
    </div>

    <!-- Logout -->
    <div class="pt-4 border-t border-gray-100 dark:border-gray-800">
      <div
        class="text-base font-semibold text-gray-900 dark:text-gray-100 mb-4"
      >
        {{ $t('auth.logout') }}
      </div>
      <a-button danger @click="handleLogout">
        <div class="inline-flex items-center gap-1">
          <LogOut class="w-4 h-4" aria-hidden="true" />
          {{ $t('auth.logout') }}
        </div>
      </a-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Modal, message } from 'ant-design-vue'
import { computed, onMounted, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import LogOut from '~icons/lucide/log-out'
import { getAccountCurrent } from '../../api/account'
import { useAuth } from '../../composables/auth'
import {
  updatePassword as apiUpdatePassword,
  updateUsername as apiUpdateUsername,
} from '../../api/setting'

const { t } = useI18n()
const authStore = useAuth()
const currentUsername = ref('')

onMounted(async () => {
  try {
    const data = await getAccountCurrent()
    currentUsername.value = data.username
  } catch {
    // ignore
  }
})

// ── Username form ───────────────────────────────────────────────────────────
const usernameForm = reactive({ newUsername: '' })

const usernameDirty = computed(() => !!usernameForm.newUsername.trim())

const handleUpdateUsername = async () => {
  if (!usernameForm.newUsername.trim()) {
    message.warning(t('setting.usernameRequired'))
    return
  }
  try {
    await apiUpdateUsername(usernameForm.newUsername.trim())
    message.success(t('setting.updateUsernameSuccess'))
    currentUsername.value = usernameForm.newUsername.trim()
    usernameForm.newUsername = ''
  } catch (e: any) {
    message.error(e?.response?.data?.msg || t('setting.updateUsernameFailed'))
  }
}

// ── Password form ──────────────────────────────────────────────────────────
const passwordForm = reactive({
  oldPassword: '',
  newPassword: '',
  confirmPassword: '',
})

const passwordDirty = computed(
  () =>
    !!passwordForm.oldPassword &&
    !!passwordForm.newPassword &&
    !!passwordForm.confirmPassword
)

const handleUpdatePassword = async () => {
  if (
    !passwordForm.oldPassword ||
    !passwordForm.newPassword ||
    !passwordForm.confirmPassword
  ) {
    message.warning(t('setting.passwordRequired'))
    return
  }
  if (passwordForm.newPassword !== passwordForm.confirmPassword) {
    message.error(t('setting.passwordMismatch'))
    return
  }
  try {
    await apiUpdatePassword(passwordForm.oldPassword, passwordForm.newPassword)
    message.success(t('setting.updatePasswordSuccess'))
    passwordForm.oldPassword = ''
    passwordForm.newPassword = ''
    passwordForm.confirmPassword = ''
  } catch (e: any) {
    message.error(
      e?.response?.data?.message || t('setting.updatePasswordFailed')
    )
  }
}

// ── Logout ──────────────────────────────────────────────────────────────────
const handleLogout = () => {
  Modal.confirm({
    title: t('auth.logoutConfirmTitle'),
    content: t('auth.logoutConfirmContent'),
    okText: t('auth.logout'),
    cancelText: t('common.cancel'),
    okButtonProps: { danger: true },
    onOk: () => {
      authStore.logout()
      window.location.href = '/login'
    },
  })
}
</script>
