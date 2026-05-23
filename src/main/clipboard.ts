import { clipboard } from 'electron'
import { insertItem } from './database.ts'

let lastContent = ''
let watchInterval: ReturnType<typeof setInterval> | null = null

export function startClipboardWatcher(onChange: (content: string) => void): void {
  lastContent = clipboard.readText()

  watchInterval = setInterval(() => {
    const current = clipboard.readText()
    if (current && current !== lastContent) {
      lastContent = current
      insertItem(current)
      onChange(current)
    }
  }, 500)
}

export function stopClipboardWatcher(): void {
  if (watchInterval) {
    clearInterval(watchInterval)
    watchInterval = null
  }
}

export function copyToClipboard(content: string): void {
  lastContent = content // prevent re-ingesting our own write
  clipboard.writeText(content)
}
