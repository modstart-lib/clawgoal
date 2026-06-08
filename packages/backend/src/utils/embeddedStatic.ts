import { NextFunction, Request, Response } from 'express'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { AppConfig } from '../config.js'
import { BUILD_ID, embeddedFiles } from '../generated/uiAssets.js'

const TMP_DIR = path.join(os.tmpdir(), `${AppConfig.name}-ui-${BUILD_ID}`)

/**
 * 启动时将所有内嵌资源解压到 /tmp 目录，随后清空内存中的 Map。
 * 若本次构建已解压过（marker 文件匹配），则直接清空 Map 跳过解压。
 */
export async function initEmbeddedStatic(): Promise<void> {
  const markerFile = path.join(TMP_DIR, '.buildid')

  if (
    fs.existsSync(markerFile) &&
    fs.readFileSync(markerFile, 'utf-8').trim() === BUILD_ID
  ) {
    // 已解压，直接释放内存
    embeddedFiles.clear()
  } else {
    // 解压所有内嵌文件到临时目录
    for (const [urlPath, file] of embeddedFiles) {
      const filePath = path.join(TMP_DIR, urlPath)
      fs.mkdirSync(path.dirname(filePath), { recursive: true })
      fs.writeFileSync(filePath, Buffer.from(file.data, 'base64'))
    }
    fs.writeFileSync(markerFile, BUILD_ID)
    embeddedFiles.clear()
  }

}

/**
 * 获取 tools 二进制文件所在目录（供 tools 路由读取）。
 */

/**
 * Express 中间件：从临时磁盘目录提供静态文件，替代原先的内存方式。
 */
export function embeddedStaticMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const urlPath = req.path === '/' ? '/index.html' : req.path
  const cleanPath = urlPath.split('?')[0]

  const filePath = path.join(TMP_DIR, cleanPath)

  // 防止路径穿越攻击
  const rel = path.relative(TMP_DIR, filePath)
  if (rel.startsWith('..') || path.isAbsolute(rel)) {
    return next()
  }

  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    res.sendFile(filePath, (err) => {
      if (err) {
        if ((err as any).code === 'ECONNABORTED') return
        next(err)
      }
    })
    return
  }

  next()
}

/**
 * 发送 index.html（SPA 回退）。
 */
export function sendEmbeddedIndexHtml(res: Response): void {
  const filePath = path.join(TMP_DIR, 'index.html')
  if (fs.existsSync(filePath)) {
    res.sendFile(filePath, (err) => {
      if (err && (err as any).code !== 'ECONNABORTED') {
        res.status(500).send('Failed to serve index.html')
      }
    })
  } else {
    res.status(404).send('index.html not found')
  }
}
