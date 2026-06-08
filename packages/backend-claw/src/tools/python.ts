/**
 * python tool: writes Python code to a temp file and executes it,
 * returning stdout/stderr. Only available to roles that have python
 * in their capabilities.
 */

import { exec } from 'node:child_process'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'
import { config } from '../../../backend/src/config/index.js'
import type { ToolDefinition, ToolResult } from '../types/index.js'

const execAsync = promisify(exec)

const TIMEOUT_MS = 60_000 // 60 second timeout

export const pythonExecDefinition: ToolDefinition = {
  name: 'python',
  description:
    'Execute Python code in an isolated temporary directory and return stdout/stderr.',
  parameters: {
    type: 'object',
    properties: {
      code: {
        type: 'string',
        description: 'Python code to execute',
      },
      cwd: {
        type: 'string',
        description: 'Working directory (default: temp dir)',
      },
    },
    required: ['code'],
  },
}

export async function pythonExec(args: {
  code: string
  cwd?: string
}): Promise<ToolResult> {
  const pythonRuntime = config.runtime['python']
  const interpreter = pythonRuntime?.path || 'python3'

  // Create an isolated temp directory and write the script there
  let tempDir: string | undefined
  let scriptPath: string

  try {
    tempDir = await mkdtemp(join(tmpdir(), 'claw-py-'))
    scriptPath = join(tempDir, 'script.py')
    await writeFile(scriptPath, args.code, 'utf8')
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return { success: false, output: '', error: `python setup failed: ${msg}` }
  }

  try {
    const { stdout, stderr } = await execAsync(
      `${interpreter} "${scriptPath}"`,
      {
        cwd: args.cwd || tempDir,
        timeout: TIMEOUT_MS,
        maxBuffer: 2 * 1024 * 1024, // 2 MB output limit
        env: { ...process.env, ...config.shellEnv },
      }
    )

    const output = [stdout, stderr].filter(Boolean).join('\n---stderr---\n')
    return {
      success: true,
      output: output || '(no output)',
    }
  } catch (err: unknown) {
    // exec rejects on non-zero exit code; still surface stdout/stderr if present
    const e = err as { stdout?: string; stderr?: string; message?: string }
    const combined = [e.stdout, e.stderr]
      .filter(Boolean)
      .join('\n---stderr---\n')
    const msg = e.message ?? String(err)
    return {
      success: false,
      output: combined || '',
      error: `python failed: ${msg}`,
    }
  } finally {
    // Clean up the temp directory
    if (tempDir) {
      rm(tempDir, { recursive: true, force: true }).catch(() => {
        // ignore cleanup errors
      })
    }
  }
}
