/**
 * Skills API routes
 *
 * POST /skills/list    — 列出所有已加载的技能
 * POST /skills/detail  — 获取单个技能详情 (body: { name })
 * POST /skills/delete  — 删除技能文件并卸载 (body: { name })
 */

import { Router } from 'express'
import fs from 'node:fs/promises'
import { ResponseCodes } from '../../../../backend/src/api/types/constants'
import { apiHandler } from '../../../../backend/src/utils/api'
import { error, success } from '../../../../backend/src/utils/response'
import { useI18n } from '../../locale/index.js'
import { skillRegistry } from '../../skills/index.js'

const router: Router = Router()

/**
 * @Api /api/claw/skill/list
 * @Summary List skill
 * @ReturnDataExample [{"name":"skill-name","version":"1.0.0","description":"","tags":[]}]
 */
router.post(
  '/claw/skill/list',
  apiHandler(async (_req, res) => {
    await skillRegistry.loadAll()
    const names = skillRegistry.list()
    const skills = names
      .map((name) => {
        const s = skillRegistry.get(name)
        if (!s) return null
        const { manifest, loadedAt } = s
        return {
          name: manifest.name,
          version: manifest.version,
          description: manifest.description,
          tags: manifest.tags ?? [],
          requiredTools: manifest.requiredTools ?? [],
          loadedAt: loadedAt.toISOString(),
        }
      })
      .filter(Boolean)
    return success(res, skills)
  })
)

/**
 * @Api /api/claw/skill/detail
 * @Summary Get detail skill
 * @BodyParam name string Skill name
 * @ReturnDataExample {"name":"skill-name","version":"1.0.0","description":"","promptContext":""}
 */
router.post(
  '/claw/skill/detail',
  apiHandler(async (req, res) => {
    const { name } = req.body
    const { t } = useI18n(req)
    if (!name) {
      return error(
        res,
        ResponseCodes.DEFAULT_ERROR,
        t('claw.skillNameRequired')
      )
    }
    const skill = skillRegistry.get(name)
    if (!skill) {
      return error(res, ResponseCodes.DEFAULT_ERROR, t('claw.skillNotFound'))
    }
    const { manifest, skillDir, loadedAt } = skill
    return success(res, {
      name: manifest.name,
      version: manifest.version,
      description: manifest.description,
      tags: manifest.tags ?? [],
      requiredTools: manifest.requiredTools ?? [],
      promptContext: manifest.promptContext ?? '',
      skillDir,
      loadedAt: loadedAt.toISOString(),
    })
  })
)

/**
 * @Api /api/claw/skill/delete
 * @Summary Remove skill
 * @BodyParam name string Skill name
 * @ReturnDataExample {"success":true}
 */
router.post(
  '/claw/skill/delete',
  apiHandler(async (req, res) => {
    const { name } = req.body
    const { t } = useI18n(req)
    if (!name) {
      return error(
        res,
        ResponseCodes.DEFAULT_ERROR,
        t('claw.skillNameRequired')
      )
    }
    const skill = skillRegistry.get(name)
    if (!skill) {
      return error(res, ResponseCodes.DEFAULT_ERROR, t('claw.skillNotFound'))
    }
    await fs.rm(skill.skillDir, { recursive: true, force: true })
    skillRegistry.unload(name)
    return success(res, null, t('claw.skillDeleted'))
  })
)

export default router
