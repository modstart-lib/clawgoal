/**
 * Environment and path management utilities
 * Unified path resolution for development and production environments
 */
import os from 'os'
import path from 'path'

/**
 * Returns the project root directory.
 * - Always uses process.cwd(), i.e. the directory where the user launched the program.
 *   This keeps runtime data/config paths anchored to the caller's working directory
 *   instead of the executable location.
 */
export function getProjectRoot(): string {
  return process.cwd()
}

/**
 * Resolves a path relative to the project root directory.
 * @param relativePath Path relative to the project root
 */
export function resolvePath(...relativePath: string[]): string {
  return path.join(getProjectRoot(), ...relativePath)
}

/**
 * Expands a leading ~ to the current user's home directory.
 * e.g. "~/.clawgoal/data" → "/Users/$USER/.clawgoal/data"
 */
export function expandTilde(p: string): string {
  if (p === '~' || p.startsWith('~/') || p.startsWith('~\\')) {
    return path.join(os.homedir(), p.slice(1))
  }
  return p
}

/**
 * Returns true if the current environment is development.
 */
export function isDevelopment(): boolean {
  return process.env.NODE_ENV === 'development'
}

/**
 * Returns true if the current environment is production.
 */
export function isProduction(): boolean {
  return process.env.NODE_ENV === 'production'
}
