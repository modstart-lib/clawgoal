import Play from '~icons/lucide/play'
import Flag from '~icons/lucide/flag'
import Bot from '~icons/lucide/bot'
import GitBranch from '~icons/lucide/git-branch'
import Zap from '~icons/lucide/zap'
import Variable from '~icons/lucide/variable'
import Shuffle from '~icons/lucide/shuffle'
import ScanText from '~icons/lucide/scan-text'
import Copy from '~icons/lucide/copy'
import Package from '~icons/lucide/package'
import FolderOpen from '~icons/lucide/folder-open'
import Wrench from '~icons/lucide/wrench'
import Globe from '~icons/lucide/globe'
import Timer from '~icons/lucide/timer'
import Navigation from '~icons/lucide/navigation'
import Box from '~icons/lucide/box'

export const nodeIconMap: Record<string, any> = {
  Start: Play,
  End: Flag,
  LLM: Bot,
  IfElse: GitBranch,
  JsRunner: Zap,
  Variable: Variable,
  RandomValue: Shuffle,
  RegexExtract: ScanText,
  FileCopy: Copy,
  FileMove: Package,
  FileList: FolderOpen,
  McpToolsCall: Wrench,
  HttpRequest: Globe,
  Delay: Timer,
  SmartRouter: Navigation,
}

/** 由宿主包（如 ui-flow）注入的扩展节点图标 */
export function registerNodeIcons(icons: Record<string, any>) {
  Object.assign(nodeIconMap, icons)
}

export { Box as DefaultNodeIcon }
