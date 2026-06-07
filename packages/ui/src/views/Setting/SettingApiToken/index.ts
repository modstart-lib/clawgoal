import { EXTRA_PERMISSION_OPTIONS as CLAW_EXTRA_PERMS } from '../../../../../ui-claw/src/views/Setting/SettingApiToken/permissions'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { ALL_PERMISSION_VALUE, buildBasePermissionOptions } from './all'

export { ALL_PERMISSION_VALUE }

export function usePermissionOptions() {
  const { t } = useI18n()

  const PERMISSION_OPTIONS = computed(() => {
    const permissionOptions = [...buildBasePermissionOptions(t)]
    permissionOptions.push(...CLAW_EXTRA_PERMS)
    return [
      {
        label: t('setting.permSpecial'),
        options: [{ label: t('setting.permAll'), value: ALL_PERMISSION_VALUE }],
      },
      ...permissionOptions,
    ]
  })
  return { PERMISSION_OPTIONS }
}
