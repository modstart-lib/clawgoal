/**
 * DataHub API routes
 * - File management: manage files under ./data directory
 */
import { Router } from 'express'
import fs from 'node:fs'
import path from 'node:path'
import { resolvePath } from '../../config/env.js'
import { apiHandler } from '../../utils/api.js'
import { error, success } from '../../utils/response.js'
import { supervisorMiddleware } from '../middlewares/auth.js'
import { ResponseCodes } from '../types/constants.js'

const router: Router = Router()

// ─── Helpers ──────────────────────────────────────────────────────────────────

const DATA_ROOT = () => resolvePath('data')

function safeDataPath(relativePath: string): string | null {
  const root = DATA_ROOT()
  const resolved = path.resolve(root, relativePath)
  if (!resolved.startsWith(root + path.sep) && resolved !== root) return null
  return resolved
}

interface FileNode {
  name: string
  path: string
  type: 'file' | 'dir'
  size?: number
  mtime?: number
  children?: FileNode[]
}

function buildTree(dir: string, relBase: string, depth = 0): FileNode[] {
  if (depth > 8) return []
  let entries: fs.Dirent[]
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true })
  } catch {
    return []
  }
  return entries
    .filter((e) => !e.name.startsWith('.'))
    .map((e) => {
      const fullPath = path.join(dir, e.name)
      const relPath = path.join(relBase, e.name)
      if (e.isDirectory()) {
        return {
          name: e.name,
          path: relPath,
          type: 'dir' as const,
          children: buildTree(fullPath, relPath, depth + 1),
        }
      } else {
        let size: number | undefined
        let mtime: number | undefined
        try {
          const stat = fs.statSync(fullPath)
          size = stat.size
          mtime = stat.mtimeMs
        } catch {}
        return {
          name: e.name,
          path: relPath,
          type: 'file' as const,
          size,
          mtime,
        }
      }
    })
}

// ─── File Management ──────────────────────────────────────────────────────────

/**
 * @Api /api/setting/file/tree
 * @Summary Get tree setting file
 * @ReturnDataExample [{"name":"data","path":"","type":"dir","children":[]}]
 */
router.post(
  '/setting/file/tree',
  supervisorMiddleware,
  apiHandler(async (_req, res) => {
    const root = DATA_ROOT()
    if (!fs.existsSync(root)) fs.mkdirSync(root, { recursive: true })
    const tree = buildTree(root, '')
    return success(res, tree)
  })
)

/**
 * @Api /api/setting/file/read
 * @Summary Read setting file
 * @BodyParam path string Relative file path within data directory
 * @ReturnDataExample {"content":"file content text"}
 */
router.post(
  '/setting/file/read',
  supervisorMiddleware,
  apiHandler(async (req, res) => {
    const { path: relPath } = req.body
    if (!relPath)
      return error(res, ResponseCodes.DEFAULT_ERROR, 'path is required')
    const abs = safeDataPath(relPath)
    if (!abs) return error(res, ResponseCodes.DEFAULT_ERROR, 'Invalid path')
    if (!fs.existsSync(abs))
      return error(res, ResponseCodes.DEFAULT_ERROR, 'File not found')
    const stat = fs.statSync(abs)
    if (stat.size > 1024 * 1024)
      return error(res, ResponseCodes.DEFAULT_ERROR, 'File too large (>1MB)')
    const content = fs.readFileSync(abs, 'utf-8')
    return success(res, { content })
  })
)

/**
 * @Api /api/setting/file/write
 * @Summary Write setting file
 * @BodyParam path string Relative file path within data directory
 * @BodyParam content string File content to write
 * @ReturnDataExample {"success":true}
 */
router.post(
  '/setting/file/write',
  supervisorMiddleware,
  apiHandler(async (req, res) => {
    const { path: relPath, content } = req.body
    if (!relPath)
      return error(res, ResponseCodes.DEFAULT_ERROR, 'path is required')
    const abs = safeDataPath(relPath)
    if (!abs) return error(res, ResponseCodes.DEFAULT_ERROR, 'Invalid path')
    fs.mkdirSync(path.dirname(abs), { recursive: true })
    fs.writeFileSync(abs, content ?? '', 'utf-8')
    return success(res, null, 'Saved')
  })
)

/**
 * @Api /api/setting/file/delete
 * @Summary Remove setting file
 * @BodyParam path string Relative file/directory path within data directory
 * @ReturnDataExample {"success":true}
 */
router.post(
  '/setting/file/delete',
  supervisorMiddleware,
  apiHandler(async (req, res) => {
    const { path: relPath } = req.body
    if (!relPath)
      return error(res, ResponseCodes.DEFAULT_ERROR, 'path is required')
    const abs = safeDataPath(relPath)
    if (!abs) return error(res, ResponseCodes.DEFAULT_ERROR, 'Invalid path')
    if (!fs.existsSync(abs))
      return error(res, ResponseCodes.DEFAULT_ERROR, 'File not found')
    const stat = fs.statSync(abs)
    if (stat.isDirectory()) {
      fs.rmSync(abs, { recursive: true, force: true })
    } else {
      fs.unlinkSync(abs)
    }
    return success(res, null, 'Deleted')
  })
)

/**
 * @Api /api/setting/file/rename
 * @Summary Rename setting file
 * @BodyParam oldPath string Current relative path
 * @BodyParam newPath string New relative path
 * @ReturnDataExample {"success":true}
 */
router.post(
  '/setting/file/rename',
  supervisorMiddleware,
  apiHandler(async (req, res) => {
    const { oldPath, newPath } = req.body
    if (!oldPath || !newPath)
      return error(
        res,
        ResponseCodes.DEFAULT_ERROR,
        'oldPath and newPath are required'
      )
    const absOld = safeDataPath(oldPath)
    const absNew = safeDataPath(newPath)
    if (!absOld || !absNew)
      return error(res, ResponseCodes.DEFAULT_ERROR, 'Invalid path')
    if (!fs.existsSync(absOld))
      return error(res, ResponseCodes.DEFAULT_ERROR, 'Source not found')
    if (fs.existsSync(absNew))
      return error(
        res,
        ResponseCodes.DEFAULT_ERROR,
        'Destination already exists'
      )
    fs.mkdirSync(path.dirname(absNew), { recursive: true })
    fs.renameSync(absOld, absNew)
    return success(res, null, 'Renamed')
  })
)

export default router
