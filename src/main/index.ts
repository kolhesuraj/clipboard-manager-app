import { app, BrowserWindow, globalShortcut, ipcMain, nativeTheme, screen } from 'electron';
import { spawnSync } from 'child_process';
import path from 'path';
import { initDatabase, getItems, deleteItem, clearHistory, togglePin } from './database.ts';
import { startClipboardWatcher, stopClipboardWatcher, copyToClipboard } from './clipboard.ts';
import { createTray, toggleWindow, updateTrayTheme } from './tray.ts';
import { simulatePaste } from './paste.ts';
import { hasSilentPasteTool } from './utils/shell.ts';

process.on('unhandledRejection', (reason) => console.error('[unhandledRejection]', reason));
process.on('uncaughtException', (err) => console.error('[uncaughtException]', err));

app.commandLine.appendSwitch('disable-gpu');
app.commandLine.appendSwitch('disable-software-rasterizer');
app.disableHardwareAcceleration();

let mainWindow: BrowserWindow | null = null;
let lastFocusedIsTerminal = false;

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 500,
    height: 640,
    show: false,
    frame: false,
    transparent: true,
    resizable: true,
    skipTaskbar: true,
    alwaysOnTop: true,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  if (process.env.NODE_ENV === 'development') {
    const port = process.env.ELECTRON_RENDERER_URL?.split(':').pop() || '5173';
    mainWindow.loadURL(`http://localhost:${port}`);
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  mainWindow.on('blur', () => {
    if (mainWindow && !mainWindow.webContents.isDevToolsFocused()) {
      mainWindow.hide();
    }
  });
}

function showWindowNearCursor(): void {
  if (!mainWindow) return;
  const cursor = screen.getCursorScreenPoint();
  const display = screen.getDisplayNearestPoint(cursor);
  const { workArea } = display;
  const [w, h] = mainWindow.getSize();
  let x = cursor.x;
  let y = cursor.y;
  if (x + w > workArea.x + workArea.width) x = workArea.x + workArea.width - w;
  if (y + h > workArea.y + workArea.height) y = workArea.y + workArea.height - h;
  if (x < workArea.x) x = workArea.x;
  if (y < workArea.y) y = workArea.y;
  mainWindow.setPosition(x, y);
}

function registerGnomeShortcut(): void {
  const BINDING_PATH =
    '/org/gnome/settings-daemon/plugins/media-keys/custom-keybindings/clipboard-manager/';
  const KEY = `org.gnome.settings-daemon.plugins.media-keys.custom-keybinding:${BINDING_PATH}`;

  spawnSync('gsettings', [
    'set',
    'org.gnome.settings-daemon.plugins.media-keys',
    'custom-keybindings',
    `['${BINDING_PATH}']`,
  ]);
  spawnSync('gsettings', ['set', KEY, 'name', 'Clipboard Manager']);
  spawnSync('gsettings', ['set', KEY, 'binding', '<Super><Shift>v']);
}

app.whenReady().then(() => {
  spawnSync('gsettings', ['set', 'org.gnome.desktop.interface', 'toolkit-accessibility', 'true']);
  registerGnomeShortcut();

  initDatabase();
  createWindow();

  if (mainWindow) {
    createTray(mainWindow, nativeTheme.shouldUseDarkColors);

    nativeTheme.on('updated', () => {
      updateTrayTheme(nativeTheme.shouldUseDarkColors);
      mainWindow?.webContents.send('native-theme-changed', nativeTheme.shouldUseDarkColors);
    });

    startClipboardWatcher((content) => {
      mainWindow?.webContents.send('clipboard-changed', content);
    });

    globalShortcut.register('Super+Shift+V', () => {
      if (!mainWindow) return;
      if (mainWindow.isVisible()) {
        mainWindow.hide();
      } else {
        showWindowNearCursor();
        mainWindow.show();
        mainWindow.focus();
      }
    });
  }
});

app.on('will-quit', () => {
  stopClipboardWatcher();
  globalShortcut.unregisterAll();
});

app.on('window-all-closed', () => {
  // intentionally empty — keep the app alive in the system tray
});

// IPC handlers
ipcMain.handle('get-native-theme', () => nativeTheme.shouldUseDarkColors);
ipcMain.handle('set-native-theme', (_, source: 'system' | 'dark' | 'light') => {
  nativeTheme.themeSource = source;
});
ipcMain.handle('get-items', (_, search: string) => getItems(search));
ipcMain.handle('copy-item', (_, content: string) => {
  copyToClipboard(content);
  return true;
});
ipcMain.handle('delete-item', (_, id: number) => {
  deleteItem(id);
  return true;
});
ipcMain.handle('clear-history', () => {
  clearHistory();
  return true;
});
ipcMain.handle('toggle-pin', (_, id: number) => {
  togglePin(id);
  return true;
});
ipcMain.handle('hide-window', () => {
  mainWindow?.hide();
});
ipcMain.handle('toggle-window', () => {
  if (mainWindow) toggleWindow(mainWindow);
});

ipcMain.handle('copy-and-paste', async (_, content: string) => {
  try {
    copyToClipboard(content);

    if (!hasSilentPasteTool()) {
      mainWindow?.webContents.send('paste-tool-missing');
      return true;
    }

    mainWindow?.hide();
    await new Promise<void>((r) => setTimeout(r, 500));
    await simulatePaste(lastFocusedIsTerminal);
  } catch (err) {
    console.error('[copy-and-paste] CRASH:', err);
  }
  return true;
});
