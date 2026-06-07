import os from 'os'
import { getLocalTimeStr } from './time'
import { LocaleKey } from '../locale'

export function buildOsInfoStr(): string {
  return `${os.type()} ${os.release()} (${os.arch()})`
}

export function buildLang(language?: LocaleKey): string {
  const langMap = {
    'zh-CN': 'Chinese(简体中文)',
    'en-US': 'English',
  }
  return langMap[language ?? 'en-US'] || 'English'
}

export function buildSystemInfoPrompt(
  date: Date = new Date(),
  language?: LocaleKey
): string {
  return `## System Info
Current Time: ${getLocalTimeStr(date)}
OS: ${buildOsInfoStr()}
${buildSystemInfoLangPrompt(language)}`
}

export function buildSystemInfoLangPrompt(language?: LocaleKey) {
  return `Language: Please communicate with the user in ${buildLang(language)}`
}
