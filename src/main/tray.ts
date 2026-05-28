import { Tray, Menu, nativeImage, app } from 'electron'
import path from 'path'
import type { BrowserWindow } from 'electron'

let tray: Tray | null = null

function iconForTheme(isDark: boolean) {
  const name = isDark ? 'icon-dark.png' : 'icon-light.png'
  const base = app.isPackaged
    ? process.resourcesPath
    : path.join(__dirname, '../../resources')
  return nativeImage.createFromPath(path.join(base, name))
    .resize({ width: 22, height: 22 })
}

export function updateTrayTheme(isDark: boolean): void {
  tray?.setImage(iconForTheme(isDark))
}

export function createTray(win: BrowserWindow, isDark: boolean): Tray {
  const icon = iconForTheme(isDark)

  tray = new Tray(icon)
  tray.setToolTip('Clipboard Manager  (Super+Shift+V)')

  const menu = Menu.buildFromTemplate([
    { label: 'Show / Hide', click: () => toggleWindow(win) },
    {
      label: 'Clear History',
      click: () => win.webContents.send('clear-history-request')
    },
    { type: 'separator' },
    { label: 'Quit', click: () => app.quit() }
  ])

  tray.setContextMenu(menu)
  tray.on('click', () => toggleWindow(win))

  return tray
}

export function toggleWindow(win: BrowserWindow): void {
  if (win.isVisible()) {
    win.hide()
  } else {
    win.show()
    win.focus()
  }
}
