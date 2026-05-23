import { app, BrowserWindow, globalShortcut, ipcMain, nativeTheme, screen } from 'electron';
import { spawnSync } from 'child_process';
import { readFileSync, writeFileSync } from 'fs';
import path from 'path';
import { initDatabase, getItems, deleteItem, clearHistory, togglePin } from './database.ts';
import { startClipboardWatcher, stopClipboardWatcher, copyToClipboard } from './clipboard.ts';
import { createTray, toggleWindow, updateTrayTheme } from './tray.ts';
import { simulatePaste } from './paste.ts';
import { isTerminalFocused, hasFocusedWindow } from './utils/focus.ts';
import { hasSilentPasteTool } from './utils/shell.ts';
import { startTriggerServer, stopTriggerServer, getSocketPath } from './trigger-server.ts';

process.on('unhandledRejection', (reason) => console.error('[unhandledRejection]', reason));
process.on('uncaughtException', (err) => console.error('[uncaughtException]', err));

app.commandLine.appendSwitch('disable-gpu');
app.commandLine.appendSwitch('disable-software-rasterizer');
app.disableHardwareAcceleration();

let mainWindow: BrowserWindow | null = null;
let lastFocusedIsTerminal = false;

type AppSettings = { mutterConsent: boolean }
let settings: AppSettings = { mutterConsent: false }

function settingsPath(): string {
  return path.join(app.getPath('userData'), 'settings.json')
}
function loadSettings(): void {
  try { settings = JSON.parse(readFileSync(settingsPath(), 'utf8')) } catch { /* use defaults */ }
}
function saveSettings(): void {
  try { writeFileSync(settingsPath(), JSON.stringify(settings)) } catch { /* ignore */ }
}

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
  spawnSync('gsettings', [
    'set',
    KEY,
    'command',
    `curl -s --unix-socket ${getSocketPath()} http://localhost/toggle`,
  ]);
  spawnSync('gsettings', ['set', KEY, 'binding', '<Super><Shift>v']);
}

app.whenReady().then(() => {
  loadSettings();
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
        if (!hasFocusedWindow()) return;
        lastFocusedIsTerminal = isTerminalFocused();
        showWindowNearCursor();
        mainWindow.show();
        mainWindow.focus();
      }
    });

    startTriggerServer(
      () => mainWindow,
      () => {
        if (!hasFocusedWindow()) return;
        lastFocusedIsTerminal = isTerminalFocused();
      }
    );
  }
});

app.on('will-quit', () => {
  stopClipboardWatcher();
  stopTriggerServer();
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
ipcMain.handle('check-paste-tool', () => ({
  silent: hasSilentPasteTool(),
  mutterAllowed: settings.mutterConsent,
}));
ipcMain.handle('set-mutter-consent', (_, value: boolean) => {
  settings.mutterConsent = value;
  saveSettings();
});

// Copy content, hide the window, then simulate Ctrl+V in the previously focused app.
// Falls back to Mutter RemoteDesktop if the user has consented (shows screen-recording indicator).
// If neither path is available, keeps the window open and emits paste-tool-missing.
ipcMain.handle('copy-and-paste', async (_, content: string) => {
  try {
    copyToClipboard(content);

    if (!hasSilentPasteTool() && !settings.mutterConsent) {
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
