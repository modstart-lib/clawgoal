#!/usr/bin/env node

import { Command } from 'commander'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { useClawCli } from '../../backend-claw/src/cli/index.js'
import { registerDaemonCommand } from './cli/daemon.js'
import type { MenuNode } from './cli/menu.js'
import {
  BOLD,
  CYAN,
  DIM,
  GREEN,
  RESET,
  isMenuPath,
  navigateMenuPath,
  promptInput,
} from './cli/menu.js'
import { registerServeCommand, runServe } from './cli/serve.js'
import { AppConfig } from './config.js'
import {
  configFileExists,
  generateRandomPassword,
  isSourceRuntime,
  writeInitialConfig,
} from './config/index.js'
import { DaemonManager } from './cli/daemon.js'
import { findAvailablePort } from './utils/utils.js'

const appVersion = AppConfig.version

const program = new Command()
const daemonManager = new DaemonManager()

// ─── Setup wizard ─────────────────────────────────────────────────────────────

async function runSetupWizard(firstRun = false): Promise<boolean> {
  // Unattended auto-setup when env vars are provided (e.g. from GUI client)
  const initUsername = process.env.INIT_USERNAME
  const initPassword = process.env.INIT_PASSWORD
  const initDataPath = process.env.INIT_DATA_PATH
  if (initUsername && initPassword && initDataPath) {
    const configPath = writeInitialConfig(initUsername, initPassword, {
      dataPath: initDataPath,
    })
    console.log(`${GREEN}✔${RESET} 配置文件已自动生成: ${configPath}`)
    return true
  }

  // 非交互式环境无法进行交互式初始化，直接报错退出
  if (!process.stdin.isTTY) {
    console.error(
      `错误：非交互式环境，但配置文件不存在，请先运行 '${AppConfig.name} setup' 进行初始化。`
    )
    process.exit(1)
  }

  if (firstRun) {
    console.log(`${CYAN}首次启动，未检测到配置文件，开始初始化...${RESET}\n`)
  } else {
    console.log(
      `\n  ${BOLD}${AppConfig.title}${RESET} ${DIM}v${appVersion}${RESET} ${CYAN}初始化配置向导${RESET}\n`
    )
  }

  const defaultPassword = generateRandomPassword()
  const localDataPath = path.join(process.cwd(), 'data')
  const defaultDataPath = existsSync(localDataPath)
    ? localDataPath
    : `~/.${AppConfig.name}/data`
  const dataPath = await promptInput('数据存储路径', defaultDataPath)
  const defaultPort = await findAvailablePort(53001)
  const portStr = await promptInput('监听端口', String(defaultPort))
  const username = await promptInput('用户名', AppConfig.name)
  const password = await promptInput('密码', defaultPassword)

  const port = parseInt(portStr, 10) || 53001
  const configPath = writeInitialConfig(username, password, { dataPath, port })
  console.log(`\n${GREEN}✔${RESET} 配置文件已生成: ${configPath}`)
  console.log(`${CYAN}配置完成，请重新运行程序使配置生效。${RESET}\n`)
  process.exit(0)
}

// ─── Menu tree ────────────────────────────────────────────────────────────────

function buildMenuTree(opsNodes: MenuNode[]): MenuNode[] {
  const daemonNodes: MenuNode[] = [
    {
      label: 'start',
      desc: 'start daemon in background',
      action: async () => {
        const r = await daemonManager.start()
        console.log(r.message)
      },
    },
    {
      label: 'stop',
      desc: 'stop running daemon',
      action: () => {
        const r = daemonManager.stop()
        console.log(r.message)
      },
    },
    {
      label: 'restart',
      desc: 'restart daemon',
      action: async () => {
        const r = await daemonManager.restart()
        console.log(r.message)
      },
    },
    {
      label: 'status',
      desc: 'check daemon status',
      action: () => {
        const r = daemonManager.getStatus()
        console.log(r.message)
      },
    },
    {
      label: 'install',
      desc: 'install as system service',
      action: () => {
        const r = daemonManager.install()
        console.log(r.message)
      },
    },
    {
      label: 'update-self',
      desc: 'update binary to system path then restart',
      action: async () => {
        const r = await daemonManager.updateSelf()
        console.log(r.message)
      },
    },
    {
      label: 'uninstall',
      desc: 'remove system service',
      action: () => {
        const r = daemonManager.uninstall()
        console.log(r.message)
      },
    },
  ]

  return [
    {
      label: 'serve',
      desc: 'run in foreground (Ctrl+C to stop)',
      action: async () => {
        await runServe()
      },
    },
    {
      label: 'daemon',
      desc: 'manage background service',
      children: daemonNodes,
    },
    ...opsNodes,
  ]
}

// ─── Commander commands ───────────────────────────────────────────────────────

program
  .name(AppConfig.name)
  .description(`${AppConfig.title} - Agents Go for Goals`)
  .version(appVersion)
  .option('--token <token>', 'Authentication token (used by connect command)')

program
  .command('version')
  .description('Show version number')
  .action(() => {
    console.log(appVersion)
  })

program
  .command('check')
  .description('Check if config.yaml exists')
  .action(() => {
    if (!configFileExists()) {
      console.log('config.yaml missing')
    } else {
      console.log('success')
    }
  })

program
  .command('init')
  .description(
    'Initialize config.yaml from INIT_* env vars (used by GUI client)'
  )
  .action(() => {
    const initUsername = process.env.INIT_USERNAME
    const initPassword = process.env.INIT_PASSWORD
    const initDataPath = process.env.INIT_DATA_PATH
    if (!initUsername || !initPassword || !initDataPath) {
      console.error(
        '错误：INIT_USERNAME、INIT_PASSWORD、INIT_DATA_PATH 环境变量均为必填。'
      )
      process.exit(1)
    }
    const configPath = writeInitialConfig(initUsername, initPassword, {
      dataPath: initDataPath,
    })
    console.log(`配置文件已生成: ${configPath}`)
    process.exit(0)
  })

registerServeCommand(program)
registerDaemonCommand(program, daemonManager)
const extraMenuNodes: MenuNode[] = []
// Register claw commander commands + collect interactive menu nodes
extraMenuNodes.push(...useClawCli(program))

// ─── Entrypoint ───────────────────────────────────────────────────────────────

const args = process.argv.slice(2)

async function main() {
  // 在二进制模式下，如果未完成 setup，除 help/version/check 命令外自动进入配置向导并退出
  if (!isSourceRuntime && !configFileExists()) {
    const firstArg = args[0]
    // 这些命令本身不依赖配置，跳过检测
    const skipCommands = [
      'help',
      'version',
      'check',
      'init',
      '-h',
      '--help',
      '-V',
      '--version',
    ]
    if (!firstArg) {
      // 无参数：进入交互式初始化向导
      await runSetupWizard(true)
      // If we reach here, auto-setup completed (interactive path calls process.exit).
      // Fall through to execute the original command (e.g. serve).
    } else if (!skipCommands.includes(firstArg)) {
      // serve / daemon 等非交互命令：配置缺失时直接报错退出，不进入 setup 向导
      // 这样 daemon start() 能通过 PID 检测到进程已退出，正确报告失败
      console.error(
        `错误：配置文件不存在，请直接运行 '${AppConfig.name}' 进行初始化。`
      )
      process.exit(1)
    }
  }

  if (args.length === 0) {
    // No args: full interactive mode from root
    console.log(
      `\n  ${BOLD}${AppConfig.title}${RESET} ${DIM}v${appVersion}${RESET}\n`
    )
    if (!configFileExists()) {
      await runSetupWizard(true)
    }
    const tree = buildMenuTree(extraMenuNodes)
    await navigateMenuPath(tree, [])
  } else if (
    !args.some((a) => a.startsWith('-')) &&
    args[0] !== 'serve' &&
    isMenuPath(buildMenuTree(extraMenuNodes), args)
  ) {
    // Args form a valid menu path with no flags: use interactive tree navigation
    // Note: 'serve' is excluded here — it's a long-running foreground server and must go
    // through Commander so process.exit(0) is never called after the action returns.
    const tree = buildMenuTree(extraMenuNodes)
    await navigateMenuPath(tree, args)
    process.exit(0)
  } else {
    // Flags present or unknown path: delegate to commander
    program.parse(process.argv)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
