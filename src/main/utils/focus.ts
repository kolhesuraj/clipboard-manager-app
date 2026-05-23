import { execFileSync, spawnSync } from 'child_process'

const TERMINAL_WM_CLASSES = [
  'terminal', 'konsole', 'xterm', 'alacritty', 'kitty',
  'tilix', 'terminator', 'gnome-terminal',
]

export function isTerminalFocused(): boolean {
  try {
    const out = execFileSync('xprop', ['-root', '_NET_ACTIVE_WINDOW'], { encoding: 'utf8' }).trim()
    const winId = out.split(/\s+/).pop() || ''

    if (!winId || winId === '0x0' || winId === '0x00000000') {
      const pg = spawnSync('pgrep', ['-x', 'gnome-terminal-'], { encoding: 'utf8' })
      return pg.status === 0
    }

    const wmClass = execFileSync('xprop', ['-id', winId, 'WM_CLASS'], { encoding: 'utf8' }).toLowerCase()
    return TERMINAL_WM_CLASSES.some((t) => wmClass.includes(t))
  } catch {
    return false
  }
}

export function hasFocusedWindow(): boolean {
  try {
    const out = execFileSync('xprop', ['-root', '_NET_ACTIVE_WINDOW'], { encoding: 'utf8' }).trim()
    const winId = out.split(/\s+/).pop() || ''
    if (winId && winId !== '0x0' && winId !== '0x00000000') return true

    // winId is 0x0 — native Wayland app OR empty desktop. Ask GNOME Shell directly.
    const result = execFileSync('gdbus', [
      'call', '--session',
      '--dest', 'org.gnome.Shell',
      '--object-path', '/org/gnome/Shell',
      '--method', 'org.gnome.Shell.Eval',
      'global.get_window_actors().filter(w => w.meta_window.has_focus()).length > 0'
    ], { encoding: 'utf8' }).trim()
    return result.includes('true')
  } catch {
    return true // if we can't check, allow opening
  }
}
