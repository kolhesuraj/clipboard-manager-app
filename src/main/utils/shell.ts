import { execFileSync, spawn } from 'child_process'
import { existsSync } from 'fs'

// Check common install locations directly — avoids relying on PATH which can
// be minimal when the app is launched from GNOME Show Apps or autostart.
const BIN_DIRS = ['/usr/bin', '/usr/local/bin', '/bin', '/snap/bin']

const _whichCache = new Map<string, string | null>()

export function which(bin: string): string | null {
  if (_whichCache.has(bin)) return _whichCache.get(bin) ?? null
  let found: string | null = null
  for (const dir of BIN_DIRS) {
    const full = `${dir}/${bin}`
    if (existsSync(full)) { found = full; break }
  }
  if (!found) {
    try { found = execFileSync('which', [bin], { encoding: 'utf8' }).trim() || null } catch { /* not found */ }
  }
  _whichCache.set(bin, found)
  return found
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

// Cached at first call — GNOME version doesn't change at runtime.
let _xtestSilent: boolean | null = null

/** Returns false on GNOME 46+ where XTEST key injection internally triggers
 *  org.gnome.Mutter.RemoteDesktop.CreateSession, showing the screen-recording
 *  indicator. wtype uses zwp_virtual_keyboard_v1 and is unaffected. */
export function isXtestSilent(): boolean {
  if (_xtestSilent !== null) return _xtestSilent
  const shellPath = which('gnome-shell')
  if (!shellPath) {
    // gnome-shell not found — not a GNOME system, XTEST is generally safe.
    _xtestSilent = true
    return _xtestSilent
  }
  try {
    const out = execFileSync(shellPath, ['--version'], { encoding: 'utf8' }).trim()
    const m = out.match(/GNOME Shell (\d+)/)
    _xtestSilent = m ? parseInt(m[1], 10) < 46 : false
  } catch {
    // gnome-shell found but version unreadable — be conservative, treat as GNOME 46+.
    _xtestSilent = false
  }
  return _xtestSilent
}

/** Returns true if a non-intrusive paste tool is available.
 *  On GNOME 46+, xdotool is excluded because its XTEST calls route through
 *  Mutter RemoteDesktop internally and trigger the screen-recording indicator. */
export function hasSilentPasteTool(): boolean {
  return !!(which('wtype') || (isXtestSilent() && which('xdotool')))
}
