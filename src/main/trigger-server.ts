import http from 'http'
import { unlinkSync, existsSync } from 'fs'
import { join } from 'path'
import { app } from 'electron'
import type { BrowserWindow } from 'electron'

// Unix socket path — no port conflicts, no firewall issues, user-scoped.
// curl --unix-socket <path> http://localhost/toggle
export function getSocketPath(): string {
  return join(app.getPath('userData'), 'trigger.sock')
}

let server: http.Server | null = null

export function startTriggerServer(win: () => BrowserWindow | null, onBeforeShow?: () => void): void {
  const socketPath = getSocketPath()

  // Remove stale socket from a previous run.
  if (existsSync(socketPath)) {
    try { unlinkSync(socketPath) } catch { /* ignore */ }
  }

  server = http.createServer((req, res) => {
    res.writeHead(200)
    res.end('ok')

    const w = win()
    if (!w) return

    if (req.url === '/show') {
      onBeforeShow?.()
      w.show()
      w.focus()
    } else if (req.url === '/hide') {
      w.hide()
    } else if (req.url === '/toggle') {
      if (w.isVisible()) {
        w.hide()
      } else {
        onBeforeShow?.()
        w.show()
        w.focus()
      }
    }
  })

  server.listen(socketPath, () => {
    console.log(`[trigger] listening on unix:${socketPath}`)
  })

  server.on('error', (e: NodeJS.ErrnoException) => {
    console.error('[trigger] server error:', e.message)
  })
}

export function stopTriggerServer(): void {
  server?.close()
  const socketPath = getSocketPath()
  if (existsSync(socketPath)) {
    try { unlinkSync(socketPath) } catch { /* ignore */ }
  }
}
