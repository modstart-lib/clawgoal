import { Command } from 'commander'

export async function runServe(port?: number) {
  if (port) {
    process.env.PORT = String(port)
  }
  await import('../index.js')
}

export function registerServeCommand(program: Command) {
  program
    .command('serve')
    .description('Start server in foreground (blocking, like make dev)')
    .option('--port <port>', 'override listen port', parseInt)
    .action(async (options) => {
      await runServe(options.port)
    })
}
