/**
 * claw kernel helpers — internal subsystem utilities.
 * Initialization logic lives in index.ts (useClaw / initClaw).
 */

import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { config, configFileExists } from '../../../backend/src/config/index.js'
import { logger } from './logger.js'

/**
 * Copy built-in skills bundled with the package (dist/skills/) into the user's
 * data/skills/ directory. Runs on every startup to ensure skills are always
 * up-to-date (full overwrite).
 */
export async function seedBuiltinSkills(): Promise<void> {
  // After build: this file is at dist/kernel/main.js, built-in skills are at dist/skills/
  const builtinDir = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    '../skills'
  )
  const destDir = configFileExists() ? config.claw.skillDirs[0] : null
  if (!destDir) {
    logger.debug('Skipping built-in skill seeding: no config file found')
    return
  }
  try {
    await fs.access(builtinDir)
  } catch {
    logger.debug(`Skipping built-in skill seeding: ${builtinDir} not found`)
    return
  }
  await fs.mkdir(destDir, { recursive: true })
  await fs.cp(builtinDir, destDir, { recursive: true, force: true })
  logger.info(`Built-in skills seeded to ${destDir}`)
}

// Re-export key singletons for external consumers
export { agentManager } from '../agent/index.js'
export { channelManager } from '../channel/manager.js'
export { cronManager } from '../cron/index.js'
export { skillRegistry } from '../skills/index.js'
export { toolRegistry } from '../tools/index.js'
export { botGateway } from './gateway.js'
