import { execFileSync, spawn } from 'child_process'
import { existsSync } from 'fs'

// Check common install locations directly — avoids relying on PATH which can
// be minimal when the app is launched from GNOME Show Apps or autostart.
const BIN_DIRS = ['/usr/bin', '/usr/local/bin', '/bin', '/snap/bin']

export function which(bin: string): string | null {
  for (const dir of BIN_DIRS) {
    const full = `${dir}/${bin}`
    if (existsSync(full)) return full
  }
  try {
    return execFileSync('which', [bin], { encoding: 'utf8' }).trim() || null
  } catch {
    return null
  }
}

export function runAsync(cmd: string, args: string[]): Promise<boolean> {
  return new Promise((resolve) => {
    const proc = spawn(cmd, args, { env: process.env })
    let stderr = ''
    proc.stderr?.on('data', (d: Buffer) => { stderr += d.toString() })
    proc.on('close', (code: number | null) => {
      if (stderr) console.warn('[paste] stderr:', stderr.trim())
      resolve(code === 0)
    })
    proc.on('error', () => resolve(false))
  })
}

/** Returns true if a non-intrusive paste tool is available (wtype or xdotool).
 *  Mutter RemoteDesktop is NOT counted — it triggers the screen-recording indicator. */
export function hasSilentPasteTool(): boolean {
  return !!(which('xdotool') || which('wtype'))
}
