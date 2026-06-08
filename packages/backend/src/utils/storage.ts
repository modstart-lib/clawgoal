import { Disk } from 'flydrive'
import { FSDriver } from 'flydrive/drivers/fs'
import crypto from 'crypto'
import fs from 'fs'
import { config } from '../config/index.js'
import { getUserAgent } from './utils.js'

export interface StorageDriver {
  put(filename: string, buffer: Buffer, mimetype?: string): Promise<void>
  getUrl(filename: string): string
}

// ── Local ──────────────────────────────────────────────────────────────────

class LocalDriver implements StorageDriver {
  private disk: Disk

  constructor() {
    const uploadPath = config.upload.local.path
    fs.mkdirSync(uploadPath, { recursive: true })
    this.disk = new Disk(
      new FSDriver({ location: uploadPath, visibility: 'public' })
    )
  }

  async put(filename: string, buffer: Buffer): Promise<void> {
    await this.disk.put(filename, buffer)
  }

  getUrl(filename: string): string {
    return `${config.upload.url}${filename}`
  }
}

// ── S3-compatible (AWS / Aliyun OSS / Tencent COS / Qiniu) ────────────────

async function buildS3Driver(options: {
  region: string
  endpoint: string
  accessKeyId: string
  secretAccessKey: string
  bucket: string
  forcePathStyle?: boolean
}): Promise<StorageDriver> {
  const { PutObjectCommand, S3Client } = await import('@aws-sdk/client-s3')
  const client = new S3Client({
    region: options.region,
    endpoint: options.endpoint || undefined,
    credentials: {
      accessKeyId: options.accessKeyId,
      secretAccessKey: options.secretAccessKey,
    },
    forcePathStyle: options.forcePathStyle ?? false,
  })
  return {
    async put(
      filename: string,
      buffer: Buffer,
      mimetype?: string
    ): Promise<void> {
      await client.send(
        new PutObjectCommand({
          Bucket: options.bucket,
          Key: filename,
          Body: buffer,
          ContentType: mimetype || 'application/octet-stream',
        })
      )
    },
    getUrl(filename: string): string {
      return `${config.upload.url}${filename}`
    },
  }
}

// ── Azure Blob ─────────────────────────────────────────────────────────────

async function buildAzureDriver(): Promise<StorageDriver> {
  const { BlobServiceClient, StorageSharedKeyCredential } =
    await import('@azure/storage-blob')
  const cfg = config.upload.azureBlob
  const endpoint =
    cfg.endpoint || `https://${cfg.accountName}.blob.core.windows.net`
  const serviceClient = new BlobServiceClient(
    endpoint,
    new StorageSharedKeyCredential(cfg.accountName, cfg.accountKey)
  )
  return {
    async put(
      filename: string,
      buffer: Buffer,
      mimetype?: string
    ): Promise<void> {
      const containerClient = serviceClient.getContainerClient(
        cfg.containerName
      )
      const blockBlobClient = containerClient.getBlockBlobClient(filename)
      await blockBlobClient.uploadData(buffer, {
        blobHTTPHeaders: {
          blobContentType: mimetype || 'application/octet-stream',
        },
      })
    },
    getUrl(filename: string): string {
      return `${config.upload.url}${filename}`
    },
  }
}

// ── Qiniu ──────────────────────────────────────────────────────────────────

const QINIU_ZONE_ENDPOINTS: Record<string, string> = {
  z0: 'https://s3.cn-east-1.qiniucs.com',
  z1: 'https://s3.cn-north-1.qiniucs.com',
  z2: 'https://s3.cn-south-1.qiniucs.com',
  na0: 'https://s3.us-north-1.qiniucs.com',
  as0: 'https://s3.ap-southeast-1.qiniucs.com',
}

const QINIU_ZONE_REGIONS: Record<string, string> = {
  z0: 'cn-east-1',
  z1: 'cn-north-1',
  z2: 'cn-south-1',
  na0: 'us-north-1',
  as0: 'ap-southeast-1',
}

// ── ModStart ──────────────────────────────────────────────────────────────

class ModstartDriver implements StorageDriver {
  private urlMap: Map<string, string> = new Map()

  constructor(
    private baseUrl: string,
    private apiMemberSecret: string,
    private memberUserId: number
  ) {}

  private buildToken(): string {
    const timestamp = Math.floor(Date.now() / 1000).toString()
    const nonce = crypto.randomBytes(16).toString('hex') // 32 chars
    const sign = crypto
      .createHash('md5')
      .update(
        `${this.memberUserId}:${timestamp}:${nonce}:${this.apiMemberSecret}`
      )
      .digest('hex')
    return `${this.memberUserId}:${timestamp}:${nonce}:${sign}`
  }

  async put(
    filename: string,
    buffer: Buffer,
    mimetype?: string
  ): Promise<void> {
    const token = this.buildToken()
    const endpoint = `${this.baseUrl.replace(/\/$/, '')}/api/member_data/upload`

    const formData = new FormData()
    const blob = new Blob([buffer], {
      type: mimetype || 'application/octet-stream',
    })
    const baseName = filename.split('/').pop() || filename
    formData.append('file', blob, baseName)

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'api-member-token': token, 'User-Agent': getUserAgent() },
      body: formData,
    })

    if (!response.ok) {
      throw new Error(`ModStart 上传失败: HTTP ${response.status}`)
    }

    const json = (await response.json()) as {
      code: number
      msg: string
      data?: { fullPath?: string }
    }
    if (json.code !== 0) {
      throw new Error(`ModStart 上传失败: ${json.msg}`)
    }

    const fullPath = json.data?.fullPath ?? ''
    this.urlMap.set(filename, fullPath)
  }

  getUrl(filename: string): string {
    return (
      this.urlMap.get(filename) ??
      `${this.baseUrl.replace(/\/$/, '')}/${filename}`
    )
  }
}

// ── Factory ────────────────────────────────────────────────────────────────

async function createDriver(type: string): Promise<StorageDriver> {
  switch (type) {
    case 'local': {
      return new LocalDriver()
    }
    case 'aliyun-oss': {
      const cfg = config.upload.aliyunOss
      const endpoint = cfg.endpoint || `https://oss-${cfg.region}.aliyuncs.com`
      return buildS3Driver({
        region: cfg.region,
        endpoint,
        accessKeyId: cfg.accessKeyId,
        secretAccessKey: cfg.accessKeySecret,
        bucket: cfg.bucket,
      })
    }
    case 'tencent-cos': {
      const cfg = config.upload.tencentCos
      return buildS3Driver({
        region: cfg.region,
        endpoint: `https://cos.${cfg.region}.myqcloud.com`,
        accessKeyId: cfg.secretId,
        secretAccessKey: cfg.secretKey,
        bucket: cfg.bucket,
        forcePathStyle: false,
      })
    }
    case 'qiniu': {
      const cfg = config.upload.qiniu
      const zone = cfg.region || 'z0'
      const endpoint = QINIU_ZONE_ENDPOINTS[zone] || QINIU_ZONE_ENDPOINTS.z0
      const region = QINIU_ZONE_REGIONS[zone] || 'cn-east-1'
      return buildS3Driver({
        region,
        endpoint,
        accessKeyId: cfg.accessKey,
        secretAccessKey: cfg.secretKey,
        bucket: cfg.bucket,
        forcePathStyle: false,
      })
    }
    case 'aws-s3': {
      const cfg = config.upload.awsS3
      return buildS3Driver({
        region: cfg.region,
        endpoint: cfg.endpoint || '',
        accessKeyId: cfg.accessKeyId,
        secretAccessKey: cfg.secretAccessKey,
        bucket: cfg.bucket,
      })
    }
    case 'azure-blob': {
      return buildAzureDriver()
    }
    // modstart is handled dynamically in getStorage() — no static case here
    default:
      throw new Error(`不支持的上传驱动: ${type}`)
  }
}

// 存储 Promise 而非实例，保证并发调用不会重复初始化
let _storageDriverPromise: Promise<StorageDriver> | null = null

export async function getStorage(
  memberUserId?: number
): Promise<StorageDriver> {
  // modstart 每次按当前用户 ID 创建实例（token 中含 userId，不可复用单例）
  if (config.upload.type === 'modstart') {
    const cfg = config.upload.modstart
    return new ModstartDriver(
      cfg.baseUrl,
      cfg.apiMemberSecret,
      memberUserId ?? 0
    )
  }
  if (!_storageDriverPromise) {
    _storageDriverPromise = createDriver(config.upload.type)
  }
  return _storageDriverPromise
}

export function resetStorage(): void {
  _storageDriverPromise = null
}

/**
 * Get the full URL for a file using current driver
 */
export async function getFileUrl(filename: string): Promise<string> {
  return (await getStorage()).getUrl(filename)
}

// ── Legacy compatibility (upload.ts uses Disk directly) ───────────────────
// Keep this export alias so existing upload.ts continues to work via getStorage().put()
