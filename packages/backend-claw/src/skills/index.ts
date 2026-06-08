/**
 * Skill registry for the bot system.
 * Skills are Markdown-based prompt context injectors loaded from a skills directory.
 * Each skill is a directory containing a single SKILL.md file with YAML frontmatter.
 *
 * SKILL.md format:
 *   ---
 *   name: my-skill
 *   version: 1.0.0
 *   description: What this skill does
 *   tags: [tag1, tag2]
 *   requiredTools: [web_batch_search]
 *   ---
 *   Markdown prompt context injected into the Model system prompt...
 */

import yaml from 'js-yaml'
import fs from 'node:fs/promises'
import path from 'node:path'
import { createLogger } from '../kernel/logger.js'
import type { InstalledSkill, SkillManifest } from '../types/index.js'

const logger = createLogger('skills')

/**
 * Parse a SKILL.md file with YAML frontmatter.
 *
 * Frontmatter fields (all at top level):
 *   name        — required, unique skill identifier
 *   description — required, short human-readable description
 *   version     — optional, semver string (default: "1.0.0")
 *   tags        — optional, array of strings
 *   requiredTools — optional, array of built-in tool names this skill needs
 *
 * Everything after the closing `---` is the Markdown prompt context.
 */
function parseSkillMd(content: string, skillDir: string): SkillManifest {
  if (!content.startsWith('---')) {
    throw new Error(`SKILL.md in ${skillDir} does not contain YAML frontmatter`)
  }
  const end = content.indexOf('\n---', 3)
  if (end === -1) {
    throw new Error(`SKILL.md in ${skillDir} has unclosed frontmatter`)
  }
  const frontmatter = content.slice(3, end).trim()
  const promptContext = content.slice(end + 4).trim()

  const obj = yaml.load(frontmatter) as Record<string, unknown>
  if (typeof obj['name'] !== 'string') {
    throw new Error(`SKILL.md in ${skillDir} missing required "name" field`)
  }
  if (typeof obj['description'] !== 'string') {
    throw new Error(
      `SKILL.md in ${skillDir} missing required "description" field`
    )
  }

  return {
    name: obj['name'],
    version: typeof obj['version'] === 'string' ? obj['version'] : '1.0.0',
    description: obj['description'].trim(),
    promptContext: promptContext || undefined,
    tags: Array.isArray(obj['tags']) ? (obj['tags'] as string[]) : undefined,
    requiredTools: Array.isArray(obj['requiredTools'])
      ? (obj['requiredTools'] as string[])
      : undefined,
  }
}

export class SkillRegistry {
  private skills = new Map<string, InstalledSkill>()
  /** Name → absolute skill directory path mapping, for Model tool lookup */
  private skillPathMap = new Map<string, string>()
  private skillsDirs: string[]

  constructor(skillsDir: string | string[]) {
    this.skillsDirs = Array.isArray(skillsDir) ? skillsDir : [skillsDir]
  }

  /** Load all skills from all configured skill directories */
  async loadAll(): Promise<void> {
    this.skills.clear()
    this.skillPathMap.clear()
    for (const dir of this.skillsDirs) {
      await this.loadDir(dir)
    }
    logger.info(
      `Loaded ${this.skills.size} skills total from ${this.skillsDirs.length} dir(s)`
    )
  }

  /** Load all skills from a single directory */
  private async loadDir(dir: string): Promise<void> {
    try {
      try {
        await fs.access(dir)
      } catch {
        return
      }
      const entries = await fs.readdir(dir, { withFileTypes: true })
      const loaded: string[] = []
      const failed: string[] = []

      for (const entry of entries) {
        if (!entry.isDirectory()) continue
        const skillDir = path.join(dir, entry.name)
        const ok = await this.loadSkill(skillDir)
        if (ok) loaded.push(entry.name)
        else failed.push(entry.name)
      }

      const failedNote = failed.length
        ? `, ${failed.length} failed: ${failed.join(', ')}`
        : ''
      logger.debug(
        `Scanned skill dir: ${dir} — ${loaded.length} loaded: [${loaded.join(', ')}]${failedNote}`
      )
    } catch (err) {
      logger.warn(`Could not load skills directory: ${dir}: ${String(err)}`)
    }
  }

  /**
   * Load a single skill from its directory.
   * The directory must contain a SKILL.md file with YAML frontmatter.
   */
  async loadSkill(skillDir: string): Promise<boolean> {
    const skillMdPath = path.join(skillDir, 'SKILL.md')
    try {
      const content = await fs.readFile(skillMdPath, 'utf8')
      const manifest = parseSkillMd(content, skillDir)
      this.skills.set(manifest.name, {
        manifest,
        skillDir,
        loadedAt: new Date(),
      })
      this.skillPathMap.set(manifest.name, skillDir)
      return true
    } catch (err) {
      logger.warn(`Failed to load skill from ${skillDir}: ${String(err)}`)
      return false
    }
  }

  /** Get a skill by name */
  get(name: string): InstalledSkill | undefined {
    return this.skills.get(name)
  }

  /** List all loaded skill names */
  list(): string[] {
    return Array.from(this.skills.keys())
  }

  /** Return all skill directories being scanned */
  getSkillsDirs(): string[] {
    return [...this.skillsDirs]
  }

  /**
   * Return all valid skill directories that actually exist on the filesystem.
   */
  async getAvailableSkillsDirs(): Promise<string[]> {
    const available: string[] = []
    for (const dir of this.skillsDirs) {
      try {
        await fs.access(dir)
        available.push(dir)
      } catch {
        // ignore
      }
    }
    return available
  }

  /**
   * Return the primary skills directory (first configured dir).
   * Used by `skill_create` to know where to write new skills.
   */
  getSkillsDir(): string {
    const dir = this.skillsDirs[0]
    if (!dir) throw new Error('No skills directory configured')
    return dir
  }

  /**
   * Return a name → absolute skillDir path mapping.
   * Useful for Model tool calls that need to resolve a skill by name to its directory.
   */
  getSkillNamePathMap(): Record<string, string> {
    return Object.fromEntries(this.skillPathMap)
  }

  /** Remove a skill from the in-memory registry without touching the filesystem */
  unload(name: string): boolean {
    this.skillPathMap.delete(name)
    return this.skills.delete(name)
  }

  /** Build the skill prompt context string for a list of skill names */
  buildPromptContext(skillNames: string[]): string {
    const parts: string[] = []
    for (const name of skillNames) {
      const skill = this.skills.get(name)
      if (skill?.manifest.promptContext) {
        // Prepend the absolute skillDir so the Model can resolve all relative
        // file/script references correctly without path guessing.
        const header =
          `### Skill: ${skill.manifest.name}\n` +
          `> Skill directory (absolute path): \`${skill.skillDir}\`\n` +
          `> When running scripts or referencing files in this skill, always use the absolute path above as the base directory.`
        parts.push(`${header}\n\n${skill.manifest.promptContext}`)
      }
    }
    return parts.join('\n\n')
  }
}

import { config, configFileExists } from '../../../backend/src/config/index.js'

/** Default skill registry — loads from data/skills/ plus any extra skillDirs from config */
export const skillRegistry = new SkillRegistry(
  configFileExists() ? config.claw.skillDirs : []
)
