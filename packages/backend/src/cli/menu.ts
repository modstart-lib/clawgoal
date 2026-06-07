import fs from 'node:fs'

// ─── Types ────────────────────────────────────────────────────────────────────

export type MenuLeaf = {
  label: string
  desc: string
  action: () => Promise<void> | void
}
export type MenuBranch = { label: string; desc: string; children: MenuNode[] }
export type MenuNode = MenuLeaf | MenuBranch

export function isBranch(node: MenuNode): node is MenuBranch {
  return 'children' in node
}

// ─── ANSI helpers ─────────────────────────────────────────────────────────────

export const RESET = '\x1b[0m'
export const GREEN = '\x1b[32m'
export const RED = '\x1b[31m'
export const CYAN = '\x1b[36m'
export const BOLD = '\x1b[1m'
export const DIM = '\x1b[2m'
const CLEAR_LINE = '\x1b[2K\x1b[G'

// ─── Prompt helper ────────────────────────────────────────────────────────────

function readStdinLine(prompt: string): Promise<string> {
  return new Promise((resolve) => {
    process.stdout.write(prompt)
    process.stdin.setEncoding('utf8')
    process.stdin.resume()
    process.stdin.once('data', (chunk) => {
      process.stdin.pause()
      resolve(chunk.toString().split('\n')[0].trim())
    })
  })
}

export async function promptInput(
  question: string,
  defaultValue: string
): Promise<string> {
  const answer = await readStdinLine(
    `${CYAN}?${RESET} ${BOLD}${question}${RESET} ${DIM}(默认: ${defaultValue})${RESET}: `
  )
  return answer || defaultValue
}

export async function promptOptional(
  question: string,
  hint = '可选, 直接回车跳过'
): Promise<string | undefined> {
  const answer = await readStdinLine(
    `${CYAN}?${RESET} ${BOLD}${question}${RESET} ${DIM}(${hint})${RESET}: `
  )
  return answer === '' ? undefined : answer
}

// ─── Menu rendering ──────────────────────────────────────────────────────────────

function renderMenu(
  title: string,
  items: { label: string; desc: string }[],
  selected: number,
  lines: number
): number {
  if (lines > 0) process.stdout.write(`\x1b[${lines}A`)
  process.stdout.write(`${CYAN}?${RESET} ${BOLD}${title}${RESET}\n`)
  for (let i = 0; i < items.length; i++) {
    const cursor = i === selected ? `${GREEN}❯${RESET}` : ' '
    const label =
      i === selected ? `${BOLD}${items[i].label}${RESET}` : items[i].label
    const desc = `${DIM}${items[i].desc}${RESET}`
    process.stdout.write(
      `${CLEAR_LINE}  ${cursor} ${label.padEnd(12)} ${desc}\n`
    )
  }
  return 1 + items.length
}

export function selectMenu(
  title: string,
  items: { label: string; desc: string }[]
): Promise<number> {
  return new Promise((resolve) => {
    let selected = 0
    let renderedLines = 0

    const isTTY = process.stdin.isTTY
    if (isTTY) {
      try {
        process.stdin.setRawMode(true)
      } catch {}
    }
    process.stdin.resume()

    renderedLines = renderMenu(title, items, selected, renderedLines)

    const cleanup = () => {
      process.stdin.removeListener('data', onData)
      process.stdin.removeListener('error', onError)
      if (isTTY) {
        try {
          process.stdin.setRawMode(false)
        } catch {}
      }
      process.stdin.pause()
    }

    const onError = (err: NodeJS.ErrnoException) => {
      if (err.code === 'EPERM' || err.code === 'EIO') {
        cleanup()
        selectByNumber(title, items, selected).then(resolve)
        return
      }
      throw err
    }
    process.stdin.on('error', onError)

    const onData = (buf: Buffer) => {
      const str = buf.toString()
      // Ctrl+C
      if (str === '\x03') {
        process.stdout.write('\n')
        process.exit(0)
      }
      // Up arrow: ESC[A
      if (str === '\x1B[A')
        selected = (selected - 1 + items.length) % items.length
      // Down arrow: ESC[B
      else if (str === '\x1B[B') selected = (selected + 1) % items.length
      // Enter
      else if (str === '\r' || str === '\n') {
        cleanup()
        process.stdout.write(
          `${CLEAR_LINE}${GREEN}✔${RESET} ${BOLD}${title}${RESET}  ${items[selected].label}\n`
        )
        resolve(selected)
        return
      }
      renderedLines = renderMenu(title, items, selected, renderedLines)
    }

    process.stdin.on('data', onData)
  })
}

function selectByNumber(
  _title: string,
  items: { label: string; desc: string }[],
  defaultIdx: number
): Promise<number> {
  return new Promise((resolve) => {
    process.stdout.write('\n')
    items.forEach((item, i) => {
      const cursor = i === defaultIdx ? `${GREEN}❯${RESET}` : ' '
      process.stdout.write(
        `  ${cursor} ${String(i + 1).padEnd(3)} ${item.label.padEnd(24)} ${DIM}${item.desc}${RESET}\n`
      )
    })
    process.stdout.write(
      `${CYAN}输入编号选择 (1-${items.length}, 回车默认 ${defaultIdx + 1})${RESET}: `
    )

    let ttyStream: fs.ReadStream | null = null
    try {
      const fd = fs.openSync('/dev/tty', 'r+')
      ttyStream = fs.createReadStream('', { fd, autoClose: true })
      ttyStream.setEncoding('utf8')
    } catch {
      process.stdout.write('\n')
      resolve(defaultIdx)
      return
    }

    let buf = ''
    ttyStream.on('data', (chunk: string | Buffer) => {
      buf += chunk.toString()
      const nl = buf.indexOf('\n')
      if (nl === -1) return
      ttyStream?.destroy()
      const line = buf.slice(0, nl).trim()
      if (line === '') {
        resolve(defaultIdx)
        return
      }
      const n = parseInt(line, 10)
      resolve(n >= 1 && n <= items.length ? n - 1 : defaultIdx)
    })
    ttyStream.on('error', () => {
      process.stdout.write('\n')
      resolve(defaultIdx)
    })
  })
}

// ─── Menu engine ──────────────────────────────────────────────────────────────

const BACK_ITEM = { label: 'back', desc: 'return to previous menu' }
const QUIT_ITEM = { label: 'quit', desc: 'exit program' }

/**
 * Run an interactive loop at one menu level.
 * - isRoot=true  → only "quit" appended (no back)
 * - isRoot=false → "back" + "quit" appended
 * Leaf actions execute and stay at this level.
 * Branch selection recurses one level down.
 * "back" returns from this function; "quit" calls process.exit(0).
 */
export async function runMenuLevel(
  nodes: MenuNode[],
  isRoot: boolean
): Promise<void> {
  while (true) {
    const extras = isRoot ? [QUIT_ITEM] : [BACK_ITEM, QUIT_ITEM]
    const items = [
      ...nodes.map((n) => ({ label: n.label, desc: n.desc })),
      ...extras,
    ]

    const idx = await selectMenu('What do you want to do?', items)
    console.log('')

    // quit (always last)
    if (idx === items.length - 1) {
      process.exit(0)
    }

    // back (second-to-last, non-root only)
    if (!isRoot && idx === items.length - 2) {
      return
    }

    const node = nodes[idx]
    if (isBranch(node)) {
      await runMenuLevel(node.children, false)
    } else {
      await node.action()
      console.log('')
    }
  }
}

/**
 * Validate that a path exists in the menu tree.
 * Returns false if any segment is not found or if there are extra segments past a leaf.
 */
export function isMenuPath(nodes: MenuNode[], path: string[]): boolean {
  if (path.length === 0) return true
  const [head, ...tail] = path
  const node = nodes.find((n) => n.label === head)
  if (!node) return false
  if (tail.length === 0) return true
  return isBranch(node) ? isMenuPath(node.children, tail) : false
}

/**
 * Navigate a path through the menu tree, then:
 * - Empty path  → run root level interactively (isRoot=true, has quit, no back)
 * - Path → branch → enter that level interactively (isRoot=false, has back + quit)
 * - Path → leaf  → execute the action and return (caller should process.exit)
 */
export async function navigateMenuPath(
  nodes: MenuNode[],
  path: string[]
): Promise<void> {
  if (path.length === 0) {
    await runMenuLevel(nodes, true)
    return
  }

  const [head, ...tail] = path
  const node = nodes.find((n) => n.label === head)!

  if (tail.length === 0) {
    if (isBranch(node)) {
      await runMenuLevel(node.children, false)
    } else {
      await node.action()
    }
    return
  }

  // More segments — must be a branch
  await navigateMenuPath((node as MenuBranch).children, tail)
}
