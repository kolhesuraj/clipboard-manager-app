import { spawn } from 'child_process'
import { existsSync } from 'fs'
import { which, runAsync } from './utils/shell.ts'

export function writeToSystemClipboard(text: string): void {
  if (existsSync('/usr/bin/wl-copy')) {
    const proc = spawn('wl-copy', [], {
      env: { ...process.env, WAYLAND_DISPLAY: process.env.WAYLAND_DISPLAY || 'wayland-0' },
      detached: true,
      stdio: ['pipe', 'ignore', 'ignore'],
    })
    proc.stdin.write(text)
    proc.stdin.end()
    proc.unref()
  }
}

function buildMutterScript(isTerminal: boolean): string {
  const keyBlock = isTerminal
    ? `
    CTRL  = dbus.UInt32(65507)
    SHIFT = dbus.UInt32(65505)
    V     = dbus.UInt32(86)
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

async function simulateViaMutter(isTerminal: boolean): Promise<boolean> {
  return runAsync('python3', ['-c', buildMutterScript(isTerminal)])
}

async function simulateViaXdotool(isTerminal: boolean): Promise<boolean> {
  if (!which('xdotool')) return false
  const keys = isTerminal ? 'ctrl+shift+v' : 'ctrl+v'
  return runAsync('xdotool', ['key', '--clearmodifiers', keys])
}

async function simulateViaWtype(isTerminal: boolean): Promise<boolean> {
  if (!which('wtype')) return false
  const args = isTerminal
    ? ['-M', 'ctrl', '-M', 'shift', '-k', 'v', '-m', 'shift', '-m', 'ctrl']
    : ['-M', 'ctrl', '-k', 'v', '-m', 'ctrl']
  return runAsync('wtype', args)
}

export async function simulatePaste(isTerminal: boolean): Promise<void> {
  const label = isTerminal ? 'Ctrl+Shift+V (terminal)' : 'Ctrl+V'
  console.log(`[paste] sending ${label}`)

  if (await simulateViaXdotool(isTerminal)) { console.log('[paste] xdotool ok'); return }
  if (await simulateViaWtype(isTerminal))   { console.log('[paste] wtype ok');   return }
  if (await simulateViaMutter(isTerminal))  { console.log('[paste] mutter ok');  return }

  console.warn('[paste] Could not simulate paste — content is in clipboard, paste manually.')
}
