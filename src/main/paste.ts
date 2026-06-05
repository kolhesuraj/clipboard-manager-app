import { spawn } from 'child_process'
import { existsSync } from 'fs'
import { which, runAsync, isXtestSilent, ydotoolWorks } from './utils/shell.ts'

// Check once — wl-copy installation won't change at runtime.
const HAS_WL_COPY = existsSync('/usr/bin/wl-copy')

// Resolve Wayland env once — used by both writeToSystemClipboard and simulateViaWtype.
function waylandEnv(): Record<string, string> {
  return {
    WAYLAND_DISPLAY: process.env.WAYLAND_DISPLAY || 'wayland-0',
    XDG_RUNTIME_DIR: process.env.XDG_RUNTIME_DIR ||
      `/run/user/${(process as NodeJS.Process & { getuid?: () => number }).getuid?.() ?? 1000}`,
  }
}

/** Write content to the Wayland clipboard so native Wayland apps can paste.
 *  wl-copy 2.2.1+ sends a libnotify "wl-clipboard is ready" notification via
 *  D-Bus. Pointing DBUS_SESSION_BUS_ADDRESS at a non-existent socket makes
 *  libnotify fail silently while the Wayland clipboard write (via
 *  WAYLAND_DISPLAY) still succeeds. */
export function writeToSystemClipboard(text: string): void {
  if (!HAS_WL_COPY) return
  const proc = spawn('wl-copy', [], {
    env: {
      ...process.env,
      ...waylandEnv(),
      DBUS_SESSION_BUS_ADDRESS: 'unix:path=/tmp/.cm-dbus-disabled',
    },
    detached: true,
    stdio: ['pipe', 'ignore', 'ignore'],
  })
  proc.stdin.write(text)
  proc.stdin.end()
  proc.unref()
}

function buildMutterScript(isTerminal: boolean): string {
  const keyBlock = isTerminal
    ? `
    CTRL  = dbus.UInt32(65507)
    SHIFT = dbus.UInt32(65505)
    V     = dbus.UInt32(118)
    sess.NotifyKeyboardKeysym(CTRL,  dbus.Boolean(True))
    sess.NotifyKeyboardKeysym(SHIFT, dbus.Boolean(True))
    sess.NotifyKeyboardKeysym(V,     dbus.Boolean(True))
    time.sleep(0.05)
    sess.NotifyKeyboardKeysym(V,     dbus.Boolean(False))
    sess.NotifyKeyboardKeysym(SHIFT, dbus.Boolean(False))
    sess.NotifyKeyboardKeysym(CTRL,  dbus.Boolean(False))`
    : `
    CTRL = dbus.UInt32(65507)
    V    = dbus.UInt32(118)
    sess.NotifyKeyboardKeysym(CTRL, dbus.Boolean(True))
    sess.NotifyKeyboardKeysym(V,    dbus.Boolean(True))
    time.sleep(0.05)
    sess.NotifyKeyboardKeysym(V,    dbus.Boolean(False))
    sess.NotifyKeyboardKeysym(CTRL, dbus.Boolean(False))`

  return `
import dbus, time, sys
try:
    bus = dbus.SessionBus()
    rd = dbus.Interface(
        bus.get_object('org.gnome.Mutter.RemoteDesktop', '/org/gnome/Mutter/RemoteDesktop'),
        'org.gnome.Mutter.RemoteDesktop'
    )
    path = rd.CreateSession()
    sess = dbus.Interface(
        bus.get_object('org.gnome.Mutter.RemoteDesktop', path),
        'org.gnome.Mutter.RemoteDesktop.Session'
    )
    sess.Start()
    ${keyBlock.trim()}
    sess.Stop()
except Exception as e:
    print(e, file=sys.stderr)
    sys.exit(1)
`.trim()
}

// Build once — determined entirely by isTerminal.
const MUTTER_SCRIPT_NORMAL   = buildMutterScript(false)
const MUTTER_SCRIPT_TERMINAL = buildMutterScript(true)

async function simulateViaMutter(isTerminal: boolean): Promise<boolean> {
  return runAsync('python3', ['-c', isTerminal ? MUTTER_SCRIPT_TERMINAL : MUTTER_SCRIPT_NORMAL])
}

async function simulateViaXdotool(isTerminal: boolean): Promise<boolean> {
  if (!which('xdotool')) return false
  // On GNOME 46+, XTEST routes through Mutter RemoteDesktop internally and
  // triggers the screen-recording indicator — skip it to avoid the prompt.
  if (!isXtestSilent()) return false
  const keys = isTerminal ? 'ctrl+shift+v' : 'ctrl+v'
  return runAsync('xdotool', ['key', '--clearmodifiers', keys], {
    DISPLAY: process.env.DISPLAY || ':0',
  })
}

async function simulateViaYdotool(isTerminal: boolean): Promise<boolean> {
  if (!ydotoolWorks()) return false
  const uid = (process as NodeJS.Process & { getuid?: () => number }).getuid?.() ?? 1000
  const socket = process.env.YDOTOOL_SOCKET || `/run/user/${uid}/ydotool`
  const keys = isTerminal ? 'ctrl+shift+v' : 'ctrl+v'
  return runAsync('ydotool', ['key', keys], { YDOTOOL_SOCKET: socket })
}

async function simulateViaWtype(isTerminal: boolean): Promise<boolean> {
  if (!which('wtype')) return false
  const args = isTerminal
    ? ['-M', 'ctrl', '-M', 'shift', '-k', 'v', '-m', 'shift', '-m', 'ctrl']
    : ['-M', 'ctrl', '-k', 'v', '-m', 'ctrl']
  // Explicitly pass Wayland env — the production Electron binary may be
  // launched without WAYLAND_DISPLAY in process.env (e.g. from GNOME Apps).
  return runAsync('wtype', args, waylandEnv())
}

export async function simulatePaste(isTerminal: boolean, mutterConsent: boolean): Promise<boolean> {
  console.log(`[paste] sending ${isTerminal ? 'Ctrl+Shift+V (terminal)' : 'Ctrl+V'}`)

  if (await simulateViaYdotool(isTerminal)) { console.log('[paste] ydotool ok'); return true }
  if (await simulateViaWtype(isTerminal))   { console.log('[paste] wtype ok');   return true }
  if (await simulateViaXdotool(isTerminal)) { console.log('[paste] xdotool ok'); return true }

  if (mutterConsent && await simulateViaMutter(isTerminal)) { console.log('[paste] mutter ok'); return true }

  console.warn('[paste] Could not simulate paste — content is in clipboard, paste manually.')
  return false
}
