import { Router } from 'express'
import fs from 'fs'
import { parseDocument } from 'yaml'
import { AppConfig } from '../../config.js'
import { config, getConfigFilePath } from '../../config/index.js'
import { useI18n } from '../../locale'
import { apiHandler } from '../../utils/api.js'
import { jsonParse, jsonStringify } from '../../utils/json.js'
import { error, success } from '../../utils/response.js'
import {
  getMultiSettings,
  getSetting,
  setMultiSettings,
  setSetting,
} from '../../utils/setting.js'
import { resetStorage } from '../../utils/storage.js'
import {
  webComponentDisabledMiddleware,
  supervisorMiddleware,
  AuthRequest,
} from '../middlewares/auth.js'
import { ResponseCodes } from '../types/constants.js'

const router = Router()

/**
 * @Api /api/setting/basic
 * @Summary Basic
 * @ReturnDataExample {"viewMode":""}
 */
router.post('/setting/basic', (_req, res) => {
  return success(res, {
    viewMode: config.viewMode,
    url: config.url ?? '',
  })
})

/**
 * @Api /api/setting/system/get
 * @Summary Get setting system
 * @ReturnDataExample {"url":"https://example.com"}
 */
router.post(
  '/setting/system/get',
  supervisorMiddleware,
  webComponentDisabledMiddleware,
  apiHandler(async (_req, res) => {
    return success(res, {
      url: config.url ?? '',
    })
  })
)

/**
 * @Api /api/setting/system/save
 * @Summary Save setting system
 * @BodyParam url string Public access URL (e.g. https://example.com)
 * @ReturnDataExample {"saved":true}
 */
router.post(
  '/setting/system/save',
  supervisorMiddleware,
  webComponentDisabledMiddleware,
  apiHandler(async (req, res) => {
    const { url } = req.body as { url?: string }

    const configPath = getConfigFilePath()
    const rawContent = fs.readFileSync(configPath, 'utf-8')
    const doc = parseDocument(rawContent)

    const normalizedUrl = (url ?? '').trim().replace(/\/$/, '')
    if (normalizedUrl) {
      doc.set('url', normalizedUrl)
    } else {
      doc.delete('url')
    }
    ;(config as any).url = normalizedUrl

    fs.writeFileSync(configPath, doc.toString(), 'utf-8')
    return success(res, { saved: true })
  })
)

/**
 * @Api /api/setting/account/get
 * @Summary Get setting account
 * @ReturnDataExample {"authType":"user","username":"admin"}
 */
router.post(
  '/setting/account/get',
  apiHandler(async (req, res) => {
    const userId = (req as AuthRequest).user.userId
    const tenantId = (req as AuthRequest).user.tenantId
    const isSup =
      userId === config.supervisorUserId &&
      tenantId === config.supervisorTenantId
    return success(res, {
      authType: config.auth.type,
      username: config.auth.username,
      isSupervisor: isSup,
    })
  })
)

/**
 * @Api /api/setting/username/update
 * @Summary Update setting username
 * @BodyParam newUsername string New username
 * @ReturnDataExample {"updated":true}
 */
router.post(
  '/setting/username/update',
  supervisorMiddleware,
  webComponentDisabledMiddleware,
  apiHandler(async (req, res) => {
    const { newUsername } = req.body as { newUsername: string }
    const { t } = useI18n(req)

    if (!newUsername || !newUsername.trim()) {
      return error(
        res,
        ResponseCodes.DEFAULT_ERROR,
        t('settingUsernameRequired')
      )
    }

    const configPath = getConfigFilePath()
    const rawContent = fs.readFileSync(configPath, 'utf-8')
    const doc = parseDocument(rawContent)

    // 更新 auth.username
    const authNode = doc.get('auth') as any
    if (authNode && typeof authNode === 'object') {
      doc.setIn(['auth', 'username'], newUsername.trim())
    } else {
      doc.set('auth', {
        type: config.auth.type,
        userId: config.auth.userId,
        tenantId: config.auth.tenantId,
        username: newUsername.trim(),
        password: config.auth.password,
      })
    }

    fs.writeFileSync(configPath, doc.toString(), 'utf-8')

    // 更新内存中的配置
    config.auth.username = newUsername.trim()

    return success(res, { updated: true })
  })
)

/**
 * @Api /api/setting/password/update
 * @Summary Update setting password
 * @BodyParam oldPassword string Current password
 * @BodyParam newPassword string New password
 * @ReturnDataExample {"updated":true}
 */
router.post(
  '/setting/password/update',
  supervisorMiddleware,
  webComponentDisabledMiddleware,
  apiHandler(async (req, res) => {
    const { oldPassword, newPassword } = req.body as {
      oldPassword: string
      newPassword: string
    }
    const { t } = useI18n(req)

    if (!oldPassword || !newPassword) {
      return error(
        res,
        ResponseCodes.DEFAULT_ERROR,
        t('settingPasswordFieldsRequired')
      )
    }

    if (config.auth.password !== oldPassword) {
      return error(
        res,
        ResponseCodes.DEFAULT_ERROR,
        t('settingOldPasswordWrong')
      )
    }

    const configPath = getConfigFilePath()
    const rawContent = fs.readFileSync(configPath, 'utf-8')
    const doc = parseDocument(rawContent)

    // 更新 auth.password
    const authNode = doc.get('auth') as any
    if (authNode && typeof authNode === 'object') {
      doc.setIn(['auth', 'password'], newPassword)
    } else {
      doc.set('auth', {
        type: config.auth.type,
        userId: config.auth.userId,
        tenantId: config.auth.tenantId,
        username: config.auth.username,
        password: newPassword,
      })
    }

    fs.writeFileSync(configPath, doc.toString(), 'utf-8')

    // 更新内存中的配置
    config.auth.password = newPassword

    return success(res, { updated: true })
  })
)

/**
 * @Api /api/setting/get
 * @Summary Get setting
 * @BodyParam name string Setting key
 * @ReturnDataExample {"name":"someSetting","value":"someValue"}
 */
router.post(
  '/setting/get',
  supervisorMiddleware,
  apiHandler(async (req, res) => {
    const { name } = req.body as { name: string }
    const { t } = useI18n(req)
    if (!name) {
      return error(res, ResponseCodes.DEFAULT_ERROR, t('settingNameRequired'))
    }
    const value = await getSetting(name)
    return success(res, { name, value })
  })
)

/**
 * @Api /api/setting/set
 * @Summary Set setting
 * @BodyParam name string Setting key
 * @BodyParam value string Setting value
 * @ReturnDataExample {"name":"someSetting","value":"someValue"}
 */
router.post(
  '/setting/set',
  supervisorMiddleware,
  apiHandler(async (req, res) => {
    const { name, value } = req.body as { name: string; value: string }
    const { t } = useI18n(req)
    if (!name) {
      return error(res, ResponseCodes.DEFAULT_ERROR, t('settingNameRequired'))
    }
    await setSetting(name, value ?? '')
    return success(res, { name, value })
  })
)

/**
 * @Api /api/setting/get_json
 * @Summary Get_json
 * @BodyParam name string Setting key
 * @BodyParam defaultValue any Optional default value (object/array)
 * @ReturnDataExample {"name":"someSetting","value":[1,2,3]}
 */
router.post(
  '/setting/get_json',
  supervisorMiddleware,
  apiHandler(async (req, res) => {
    const { name, defaultValue } = req.body as {
      name: string
      defaultValue?: unknown
    }
    const { t } = useI18n(req)
    if (!name) {
      return error(res, ResponseCodes.DEFAULT_ERROR, t('settingNameRequired'))
    }
    const raw = await getSetting(name)
    let value: unknown = defaultValue ?? null
    if (raw) {
      try {
        value = jsonParse(raw)
      } catch {
        value = defaultValue ?? null
      }
    }
    return success(res, { name, value })
  })
)

/**
 * @Api /api/setting/set_json
 * @Summary Set_json
 * @BodyParam name string Setting key
 * @BodyParam value any JSON-serializable value (object/array)
 * @ReturnDataExample {"name":"someSetting","value":[1,2,3]}
 */
router.post(
  '/setting/set_json',
  supervisorMiddleware,
  apiHandler(async (req, res) => {
    const { name, value } = req.body as { name: string; value: unknown }
    const { t } = useI18n(req)
    if (!name) {
      return error(res, ResponseCodes.DEFAULT_ERROR, t('settingNameRequired'))
    }
    if (value === undefined || value === null) {
      return error(res, ResponseCodes.DEFAULT_ERROR, t('optionValueRequired'))
    }
    await setSetting(name, jsonStringify(value))
    return success(res, { name, value })
  })
)

/**
 * @Api /api/setting/get_multi
 * @Summary Get_multi
 * @BodyParam names string[] Array of setting keys
 * @ReturnDataExample {"key1":"value1","key2":"value2"}
 */
router.post(
  '/setting/get_multi',
  supervisorMiddleware,
  apiHandler(async (req, res) => {
    const { names } = req.body as { names: string[] }
    const { t } = useI18n(req)
    if (!Array.isArray(names) || names.length === 0) {
      return error(
        res,
        ResponseCodes.DEFAULT_ERROR,
        t('settingNamesArrayRequired')
      )
    }
    const settings = await getMultiSettings(names)
    return success(res, settings)
  })
)

/**
 * @Api /api/setting/set_multi
 * @Summary Set_multi
 * @BodyParam settings object Key-value pairs of settings to save
 * @ReturnDataExample {"updated":true}
 */
router.post(
  '/setting/set_multi',
  supervisorMiddleware,
  apiHandler(async (req, res) => {
    const { settings } = req.body as { settings: Record<string, string> }
    const { t } = useI18n(req)
    if (!settings || typeof settings !== 'object') {
      return error(
        res,
        ResponseCodes.DEFAULT_ERROR,
        t('settingSettingFormatInvalid')
      )
    }
    await setMultiSettings(settings)
    return success(res, { updated: true })
  })
)

/**
 * @Api /api/setting/upload/get
 * @Summary Get setting upload
 * @ReturnDataExample {"type":"local","url":"","limitExt":"jpg,png,gif","limitSize":10485760}
 */
router.post(
  '/setting/upload/get',
  supervisorMiddleware,
  webComponentDisabledMiddleware,
  apiHandler(async (_req, res) => {
    return success(res, {
      type: config.upload.type,
      url: config.upload.url,
      limitExt: config.upload.limitExt,
      limitSize: config.upload.limitSize,
      local: config.upload.local,
      aliyunOss: config.upload.aliyunOss,
      tencentCos: config.upload.tencentCos,
      qiniu: config.upload.qiniu,
      awsS3: config.upload.awsS3,
      azureBlob: config.upload.azureBlob,
    })
  })
)

/**
 * @Api /api/setting/upload/save
 * @Summary Save setting upload
 * @BodyParam type string Storage driver type (local, aliyun-oss, tencent-cos, qiniu, aws-s3, azure-blob)
 * @BodyParam url string Public base URL for files
 * @BodyParam limitExt string Allowed extensions
 * @BodyParam limitSize number Max file size in bytes
 * @ReturnDataExample {"updated":true}
 */
router.post(
  '/setting/upload/save',
  supervisorMiddleware,
  webComponentDisabledMiddleware,
  apiHandler(async (req, res) => {
    const { t } = useI18n(req)
    const body = req.body as {
      type?: string
      url?: string
      limitExt?: string
      limitSize?: number
      local?: { path?: string }
      aliyunOss?: Record<string, string>
      tencentCos?: Record<string, string>
      qiniu?: Record<string, string>
      awsS3?: Record<string, string>
      azureBlob?: Record<string, string>
    }

    if (!body.type) {
      return error(
        res,
        ResponseCodes.DEFAULT_ERROR,
        t('storageUploadDriverRequired')
      )
    }

    const validTypes = [
      'local',
      'aliyun-oss',
      'tencent-cos',
      'qiniu',
      'aws-s3',
      'azure-blob',
    ]
    if (!validTypes.includes(body.type)) {
      return error(
        res,
        ResponseCodes.DEFAULT_ERROR,
        `${t('storageUploadDriverNotSupported')}: ${body.type}`
      )
    }

    const configPath = getConfigFilePath()
    const rawContent = fs.readFileSync(configPath, 'utf-8')
    const doc = parseDocument(rawContent)

    const uploadNode: Record<string, unknown> = {
      type: body.type,
      url: body.url ?? config.upload.url,
      limitExt: body.limitExt ?? config.upload.limitExt,
      limitSize: body.limitSize ?? config.upload.limitSize,
    }

    if (body.type === 'local') {
      if (body.local?.path !== undefined)
        uploadNode.local = { path: body.local.path }
    } else if (body.type === 'aliyun-oss' && body.aliyunOss) {
      uploadNode.aliyunOss = body.aliyunOss
    } else if (body.type === 'tencent-cos' && body.tencentCos) {
      uploadNode.tencentCos = body.tencentCos
    } else if (body.type === 'qiniu' && body.qiniu) {
      uploadNode.qiniu = body.qiniu
    } else if (body.type === 'aws-s3' && body.awsS3) {
      uploadNode.awsS3 = body.awsS3
    } else if (body.type === 'azure-blob' && body.azureBlob) {
      uploadNode.azureBlob = body.azureBlob
    }

    doc.set('upload', uploadNode)
    fs.writeFileSync(configPath, doc.toString(), 'utf-8')

    config.upload.type = body.type
    config.upload.url = body.url ?? config.upload.url
    config.upload.limitExt = body.limitExt ?? config.upload.limitExt
    config.upload.limitSize = body.limitSize ?? config.upload.limitSize
    if (body.local?.path !== undefined)
      config.upload.local.path = body.local.path
    if (body.aliyunOss) Object.assign(config.upload.aliyunOss, body.aliyunOss)
    if (body.tencentCos)
      Object.assign(config.upload.tencentCos, body.tencentCos)
    if (body.qiniu) Object.assign(config.upload.qiniu, body.qiniu)
    if (body.awsS3) Object.assign(config.upload.awsS3, body.awsS3)
    if (body.azureBlob) Object.assign(config.upload.azureBlob, body.azureBlob)

    resetStorage()

    return success(res, { updated: true })
  })
)

/**
 * @Api /api/setting/upload/test
 * @Summary Test setting upload
 * @BodyParam type string Optional storage type to test
 * @ReturnDataExample {"url":"https://...","driver":"local"}
 */
router.post(
  '/setting/upload/test',
  supervisorMiddleware,
  webComponentDisabledMiddleware,
  apiHandler(async (req, res) => {
    const body = req.body as {
      type?: string
      url?: string
      aliyunOss?: Record<string, string>
      tencentCos?: Record<string, string>
      qiniu?: Record<string, string>
      awsS3?: Record<string, string>
      azureBlob?: Record<string, string>
    }

    const testType = body.type ?? config.upload.type
    const testBuffer = Buffer.from(
      `${AppConfig.name}-upload-test-${Date.now()}`
    )
    const testFilename = `.${AppConfig.name}-test-${Date.now()}.txt`

    const savedType = config.upload.type
    const savedAliyunOss = { ...config.upload.aliyunOss }
    const savedTencentCos = { ...config.upload.tencentCos }
    const savedQiniu = { ...config.upload.qiniu }
    const savedAwsS3 = { ...config.upload.awsS3 }
    const savedAzureBlob = { ...config.upload.azureBlob }

    try {
      if (body.type) config.upload.type = body.type
      if (body.aliyunOss) Object.assign(config.upload.aliyunOss, body.aliyunOss)
      if (body.tencentCos)
        Object.assign(config.upload.tencentCos, body.tencentCos)
      if (body.qiniu) Object.assign(config.upload.qiniu, body.qiniu)
      if (body.awsS3) Object.assign(config.upload.awsS3, body.awsS3)
      if (body.azureBlob) Object.assign(config.upload.azureBlob, body.azureBlob)

      resetStorage()

      const { getStorage } = await import('../../utils/storage.js')
      const storage = await getStorage()
      await storage.put(testFilename, testBuffer, 'text/plain')
      const url = storage.getUrl(testFilename)

      return success(res, { url, driver: testType })
    } catch (e: any) {
      return error(
        res,
        ResponseCodes.DEFAULT_ERROR,
        `${useI18n(req).t('storageConnectionFailed')}: ${e?.message ?? useI18n(req).t('wfUnknownError')}`
      )
    } finally {
      config.upload.type = savedType
      Object.assign(config.upload.aliyunOss, savedAliyunOss)
      Object.assign(config.upload.tencentCos, savedTencentCos)
      Object.assign(config.upload.qiniu, savedQiniu)
      Object.assign(config.upload.awsS3, savedAwsS3)
      Object.assign(config.upload.azureBlob, savedAzureBlob)
      resetStorage()
    }
  })
)

// ─── Proxy ────────────────────────────────────────────────────────────────────

/**
 * @Api /api/setting/proxy/get
 * @Summary Get setting proxy
 * @ReturnDataExample {"proxies":[{"name":"my-proxy","type":"http","host":"127.0.0.1","port":"7890"}]}
 */
router.post(
  '/setting/proxy/get',
  supervisorMiddleware,
  webComponentDisabledMiddleware,
  apiHandler(async (_req, res) => {
    return success(res, {
      proxies: (config as any).proxy ?? [],
    })
  })
)

/**
 * @Api /api/setting/proxy/save
 * @Summary Save setting proxy
 * @BodyParam proxies array Array of proxy configs {name, type, host, port, username?, password?}
 * @ReturnDataExample {"saved":true}
 */
router.post(
  '/setting/proxy/save',
  supervisorMiddleware,
  webComponentDisabledMiddleware,
  apiHandler(async (req, res) => {
    const { proxies } = req.body as {
      proxies: Array<{
        name: string
        type: 'http' | 'socks5'
        host: string
        port: string
        username?: string
        password?: string
      }>
    }

    const normalised = (proxies ?? []).map((p) => ({
      name: p.name,
      type: p.type ?? 'http',
      host: p.host ?? '',
      port: p.port ?? '',
      ...(p.username ? { username: p.username } : {}),
      ...(p.password ? { password: p.password } : {}),
    }))

    const configPath = getConfigFilePath()
    const rawContent = fs.readFileSync(configPath, 'utf-8')
    const doc = parseDocument(rawContent)
    doc.set('proxy', normalised)
    ;(config as any).proxy = normalised
    fs.writeFileSync(configPath, doc.toString(), 'utf-8')

    return success(res, { saved: true })
  })
)

/**
 * @Api /api/setting/proxy/test
 * @Summary Test setting proxy
 * @BodyParam proxyName string Proxy name to test
 * @BodyParam url string URL to test connectivity
 * @ReturnDataExample {"ok":true,"statusCode":200,"ms":350}
 */
router.post(
  '/setting/proxy/test',
  supervisorMiddleware,
  webComponentDisabledMiddleware,
  apiHandler(async (req, res) => {
    const { proxyName, url } = req.body as { proxyName: string; url: string }

    if (!url) {
      return error(res, -1, 'url is required')
    }

    const proxy = (config as any).proxy?.find((x: any) => x.name === proxyName)
    if (!proxy) {
      return error(res, -1, `Proxy "${proxyName}" not found`)
    }

    const { buildProxyUrl } = await import('../../config/index.js')
    const proxyUrl = buildProxyUrl(proxy)
    if (!proxyUrl) {
      return error(res, -1, 'Proxy has no host/port configured')
    }

    try {
      let statusCode: number
      if (proxy.type === 'socks5') {
        // Bun's fetch does not support socks5:// protocol natively.
        // Use the socks package directly to create a SOCKS5 tunnel socket,
        // then optionally upgrade to TLS and send a raw HTTP request.
        const { SocksClient } = await import('socks')
        const { default: tls } = await import('tls')
        const targetUrl = new URL(url)
        const targetHost = targetUrl.hostname
        const targetPort =
          parseInt(targetUrl.port) ||
          (targetUrl.protocol === 'https:' ? 443 : 80)
        const socksOpts: any = {
          proxy: {
            host: proxy.host,
            port: parseInt(proxy.port, 10),
            type: 5,
          },
          command: 'connect',
          destination: { host: targetHost, port: targetPort },
          timeout: 10000,
        }
        if (proxy.username) {
          socksOpts.proxy.userId = proxy.username
          if (proxy.password) socksOpts.proxy.password = proxy.password
        }
        const info = await SocksClient.createConnection(socksOpts)
        let socket: any = info.socket
        if (targetUrl.protocol === 'https:') {
          socket = tls.connect({
            socket,
            servername: targetHost,
            rejectUnauthorized: false,
          })
          await new Promise<void>((resolve, reject) => {
            socket.once('secureConnect', resolve)
            socket.once('error', reject)
          })
        }
        const reqPath = (targetUrl.pathname || '/') + (targetUrl.search || '')
        socket.write(
          `GET ${reqPath} HTTP/1.1\r\nHost: ${targetHost}\r\nConnection: close\r\n\r\n`
        )
        statusCode = await new Promise<number>((resolve, reject) => {
          let buf = ''
          socket.on('data', (chunk: Buffer) => {
            buf += chunk.toString('binary')
            const m = buf.match(/^HTTP\/1\.[01] (\d{3})/)
            if (m) {
              resolve(parseInt(m[1], 10))
              socket.destroy()
            }
          })
          socket.once('error', reject)
          socket.once('close', () => {
            const m = buf.match(/^HTTP\/1\.[01] (\d{3})/)
            if (m) resolve(parseInt(m[1], 10))
            else reject(new Error('No HTTP response received'))
          })
        })
      } else {
        // HTTP proxy: Bun's native fetch supports http:// proxy directly.
        const response = await (fetch as any)(url, {
          signal: AbortSignal.timeout(10000),
          proxy: proxyUrl,
        })
        statusCode = response.status
        await response.body?.cancel().catch(() => {})
      }
      return success(res, {
        statusCode,
        ok: statusCode >= 200 && statusCode < 400,
      })
    } catch (err: any) {
      const msg = err?.message ?? String(err)
      const isTimeout =
        err?.name === 'AbortError' || /timed?\s*out|timeout/i.test(msg)
      return success(res, {
        ok: false,
        error: isTimeout ? 'Connection timed out' : msg,
      })
    }
  })
)

export default router
