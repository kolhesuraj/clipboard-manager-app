import { execFileSync, spawnSync } from 'child_process'

// WM_CLASS substrings for X11/XWayland terminals (matched lowercase).
const TERMINAL_WM_CLASSES = [
  'terminal', 'konsole', 'xterm', 'alacritty', 'kitty',
  'tilix', 'terminator', 'gnome-terminal', 'kgx', 'ptyxis',
]

// Process names for native Wayland terminals (no X11 window, xprop returns 0x0).
const TERMINAL_PROCS = [
  'gnome-terminal-', 'kgx', 'kitty', 'alacritty', 'foot',
  'wezterm-gui', 'tilix', 'xfce4-terminal', 'konsole', 'terminator', 'ptyxis',
]

/** Returns focused state and terminal detection in a single xprop call.
 *
 *  For native Wayland windows (xprop returns 0x0), GNOME Shell.Eval is disabled
 *  on GNOME 46+ so we skip it entirely and fall back to process-name detection.
 *  focused is always true in that path — the global shortcut wouldn't fire
 *  unless the user was actively in a window. */
export function getFocusState(): { focused: boolean; isTerminal: boolean } {
  // Step 1: get the active X11 window ID.
  let winId: string | null = null
  try {
    const out = execFileSync('xprop', ['-root', '_NET_ACTIVE_WINDOW'], { encoding: 'utf8' }).trim()
    const id = out.split(/\s+/).pop() || ''
    if (id && id !== '0x0' && id !== '0x00000000') winId = id
  } catch { /* xprop unavailable */ }

  // Step 2: valid X11/XWayland window — check WM_CLASS.
  if (winId) {
    try {
      const raw = execFileSync('xprop', ['-id', winId, 'WM_CLASS'], { encoding: 'utf8' })
      // xprop writes "WM_CLASS: not found." to stdout (not stderr) when the
      // property is absent — this happens for native Wayland proxy windows.
      // Only trust the result if the property was actually returned.
      if (raw.toLowerCase().includes('wm_class(string)')) {
        const wmClass = raw.toLowerCase()
        return { focused: true, isTerminal: TERMINAL_WM_CLASSES.some(t => wmClass.includes(t)) }
      }
    } catch { /* fall through */ }
  }

  // Step 3: native Wayland window (0x0) or proxy WM_CLASS failed.
  // Identify the terminal by checking which known emulators are running.
  const isTerminal = TERMINAL_PROCS.some(name =>
    spawnSync('pgrep', ['-x', name], { encoding: 'utf8' }).status === 0
  )
  return { focused: true, isTerminal }
}
