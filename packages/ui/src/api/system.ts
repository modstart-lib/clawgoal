import apiClient from './client'

export interface SystemStats {
  cpu: {
    usage: number
    count: number
    model: string
  }
  memory: {
    total: number
    used: number
    free: number
    usagePercent: number
  }
  disk: {
    total: number
    used: number
    free: number
    usagePercent: number
  }
  process: {
    rss: number
    heapUsed: number
    heapTotal: number
    external: number
    arrayBuffers: number
  }
  connections: {
    manage: number
    extension: number
    connector: number
    agent: number
  }
  uptime: number
  platform: string
  arch: string
}

export interface SystemPathItem {
  name: string
  type: 'file' | 'dir'
  path: string
}

export interface SystemPathList {
  path: string
  parentPath: string | null
  items: SystemPathItem[]
}

export interface VersionCheckResult {
  hasNew: boolean
  latestVersion: string
  summary: string
  feature: string
  releaseDate: string
  downloadUrl: string
  currentVersion: string
}

export const systemApi = {
  getStats(): Promise<SystemStats> {
    return apiClient.post('/system/stats').then((res: any) => res.data.data)
  },
  pathList(dirPath?: string): Promise<SystemPathList> {
    return apiClient
      .post('/system/pathList', { path: dirPath })
      .then((res: any) => res.data.data)
  },
  checkVersion(currentVersion: string): Promise<VersionCheckResult> {
    return apiClient
      .post('/system/checkVersion', { currentVersion })
      .then((res: any) => res.data.data)
  },

  /**
   * Submit user behavior data for collection.
   * @param name Data name (e.g. "visit")
   * @param data Data payload
   */
  collect(name: string, data: unknown): Promise<void> {
    return apiClient.post('/collect', { name, data }).then(() => undefined)
  },
}
