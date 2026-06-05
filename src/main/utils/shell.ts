import { execFileSync, spawn, spawnSync } from 'child_process'
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

export function runAsync(cmd: string, args: string[], extraEnv?: Record<string, string>): Promise<boolean> {
  return new Promise((resolve) => {
    const proc = spawn(cmd, args, { env: { ...process.env, ...extraEnv } })
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

// Cached after first probe — compositor support doesn't change at runtime.
let _wtypeWorks: boolean | null = null

/** Tests whether wtype can actually connect to the compositor.
 *  On GNOME 45+, zwp_virtual_keyboard_v1 is restricted for regular apps
 *  even when the wtype binary exists — so a binary-only check is not enough. */
function wtypeWorks(): boolean {
  if (_wtypeWorks !== null) return _wtypeWorks
  const path = which('wtype')
  if (!path) { _wtypeWorks = false; return false }
  const result = spawnSync(path, [''], {
    env: {
      ...process.env,
      WAYLAND_DISPLAY: process.env.WAYLAND_DISPLAY || 'wayland-0',
      XDG_RUNTIME_DIR: process.env.XDG_RUNTIME_DIR || `/run/user/1000`,
    },
    timeout: 2000,
    encoding: 'utf8',
  })
  _wtypeWorks = result.status === 0
  if (!_wtypeWorks) console.log('[paste] wtype probe failed:', result.stderr?.trim())
  return _wtypeWorks
}

/** Returns true if a non-intrusive paste tool is available.
 *  On GNOME 46+, xdotool is excluded because its XTEST calls route through
 *  Mutter RemoteDesktop internally and trigger the screen-recording indicator.
 *  wtype is probed at runtime — on GNOME 45+ the compositor restricts
 *  zwp_virtual_keyboard_v1 even when the binary is installed. */
export function hasSilentPasteTool(): boolean {
  return !!(wtypeWorks() || (isXtestSilent() && which('xdotool')))
}
