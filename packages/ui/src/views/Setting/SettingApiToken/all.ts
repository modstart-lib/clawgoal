export const ALL_PERMISSION_VALUE = '*'

type TFn = (key: string) => string

export function buildBasePermissionOptions(t: TFn) {
  return [
    {
      label: t('setting.permAuth'),
      options: [
        { label: t('setting.permLogin'), value: 'login' },
        { label: t('setting.permLoginRefresh'), value: 'login/refresh' },
      ],
    },
    {
      label: t('setting.permUpload'),
      options: [
        { label: t('setting.permUploadFile'), value: 'upload' },
        { label: t('setting.permUploadImage'), value: 'upload/image' },
      ],
    },
    {
      label: t('setting.permSystem'),
      options: [
        { label: t('setting.permSystemStats'), value: 'system/stats' },
        { label: t('setting.permSystemPathList'), value: 'system/pathList' },
        {
          label: t('setting.permSystemCollectEnv'),
          value: 'system/collectEnv',
        },
        {
          label: t('setting.permSystemCollectLog'),
          value: 'system/collectLog',
        },
        {
          label: t('setting.permSystemCheckVersion'),
          value: 'system/checkVersion',
        },
        { label: t('setting.permPing'), value: 'ping' },
      ],
    },
    {
      label: t('setting.permSettings'),
      options: [
        {
          label: t('setting.permSettingAccountGet'),
          value: 'setting/account/get',
        },
        {
          label: t('setting.permSettingPasswordUpdate'),
          value: 'setting/password/update',
        },
        {
          label: t('setting.permSettingSystemGet'),
          value: 'setting/system/get',
        },
        {
          label: t('setting.permSettingSystemSave'),
          value: 'setting/system/save',
        },
        {
          label: t('setting.permSettingUsernameUpdate'),
          value: 'setting/username/update',
        },
        { label: t('setting.permSettingGet'), value: 'setting/get' },
        { label: t('setting.permSettingSet'), value: 'setting/set' },
        {
          label: t('setting.permSettingGetMulti'),
          value: 'setting/get_multi',
        },
        {
          label: t('setting.permSettingSetMulti'),
          value: 'setting/set_multi',
        },
        {
          label: t('setting.permSettingUploadGet'),
          value: 'setting/upload/get',
        },
        {
          label: t('setting.permSettingUploadSave'),
          value: 'setting/upload/save',
        },
        {
          label: t('setting.permSettingUploadTest'),
          value: 'setting/upload/test',
        },
      ],
    },
    {
      label: t('setting.permApiTokenGroup'),
      options: [
        {
          label: t('setting.permApiTokenPaginate'),
          value: 'setting/apiToken/paginate',
        },
        {
          label: t('setting.permApiTokenAdd'),
          value: 'setting/apiToken/add',
        },
        {
          label: t('setting.permApiTokenEdit'),
          value: 'setting/apiToken/edit',
        },
        {
          label: t('setting.permApiTokenDelete'),
          value: 'setting/apiToken/delete',
        },
        {
          label: t('setting.permApiTokenGet'),
          value: 'setting/apiToken/get',
        },
        {
          label: t('setting.permApiTokenRegenerate'),
          value: 'setting/apiToken/regenerate',
        },
      ],
    },
    {
      label: t('setting.permDataCenter'),
      options: [
        { label: t('setting.permFileTree'), value: 'claw/file/tree' },
        { label: t('setting.permFileRead'), value: 'claw/file/read' },
        { label: t('setting.permFileWrite'), value: 'claw/file/write' },
        { label: t('setting.permFileDelete'), value: 'claw/file/delete' },
        { label: t('setting.permFileRename'), value: 'claw/file/rename' },
        { label: t('setting.permDbList'), value: 'claw/datahub/db/list' },
        { label: t('setting.permDbTables'), value: 'claw/datahub/db/tables' },
        { label: t('setting.permDbSchema'), value: 'claw/datahub/db/schema' },
        { label: t('setting.permDbRows'), value: 'claw/datahub/db/rows' },
        {
          label: t('setting.permDbDeleteRow'),
          value: 'claw/datahub/db/deleteRow',
        },
        {
          label: t('setting.permDbExecute'),
          value: 'claw/datahub/db/execute',
        },
        {
          label: t('setting.permDbUpdateRow'),
          value: 'claw/datahub/db/updateRow',
        },
      ],
    },
    {
      label: t('setting.permModelConfig'),
      options: [
        {
          label: t('setting.permModelProviderGet'),
          value: 'config/modelProvider/get',
        },
        {
          label: t('setting.permModelProviderSave'),
          value: 'config/modelProvider/save',
        },
        {
          label: t('setting.permModelProviderTest'),
          value: 'config/modelProvider/test',
        },
        {
          label: t('setting.permEmbeddingGet'),
          value: 'config/embeddingModel/get',
        },
        {
          label: t('setting.permEmbeddingSave'),
          value: 'config/embeddingModel/save',
        },
        {
          label: t('setting.permEmbeddingTest'),
          value: 'config/embeddingModel/test',
        },
        { label: t('setting.permModelGet'), value: 'config/model/get' },
        { label: t('setting.permModelSave'), value: 'config/model/save' },
        { label: t('setting.permProxyGet'), value: 'setting/proxy/get' },
        { label: t('setting.permProxySave'), value: 'setting/proxy/save' },
        { label: t('setting.permProxyTest'), value: 'setting/proxy/test' },
        {
          label: t('setting.permRuntimeGet'),
          value: 'config/runtime/get',
        },
        {
          label: t('setting.permRuntimeDetectVersion'),
          value: 'config/runtime/detectVersion',
        },
        {
          label: t('setting.permRuntimeSave'),
          value: 'config/runtime/save',
        },
      ],
    },
    {
      label: t('setting.permModelCall'),
      options: [
        { label: t('setting.permChat'), value: 'model/chat' },
        { label: t('setting.permChatStream'), value: 'model/chatStream' },
        { label: t('setting.permModelStats'), value: 'claw/model/stats' },
        {
          label: t('setting.permModelDailyStats'),
          value: 'claw/model/dailyStats',
        },
        {
          label: t('setting.permModelHourlyStats'),
          value: 'claw/model/hourlyStats',
        },
      ],
    },
  ]
}

// 保留旧的静态导出用于向后兼容（未多语言场景）
export const BASE_PERMISSION_OPTIONS = buildBasePermissionOptions((k) => k)
