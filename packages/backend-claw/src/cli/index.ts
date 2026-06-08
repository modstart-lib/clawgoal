import type { Command } from 'commander'
import type { MenuNode } from '../../../backend/src/cli/menu.js'
import { promptInput } from '../../../backend/src/cli/menu.js'
import { performConnect, registerRuntimeCommand } from './connect'

/**
 * Register claw-related commander commands and return the corresponding
 * interactive menu tree nodes for the interactive CLI.
 */
export function useClawCli(program: Command): MenuNode[] {
  // Register direct CLI commands (for scripting / flag-based usage)
  registerRuntimeCommand(program)

  // Interactive menu nodes
  return [
    {
      label: 'connect',
      desc: 'connect to backend as runner',
      action: async () => {
        const url = await promptInput('Backend URL', '')
        if (!url) {
          console.log('已取消')
          return
        }
        const token = await promptInput('Token', '')
        if (!token) {
          console.log('已取消')
          return
        }
        performConnect(url, token)
      },
    },
  ]
}
