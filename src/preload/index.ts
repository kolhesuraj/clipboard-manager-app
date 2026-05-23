import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  getItems: (search: string) => ipcRenderer.invoke('get-items', search),
  copyItem: (content: string) => ipcRenderer.invoke('copy-item', content),
  copyAndPaste: (content: string) => ipcRenderer.invoke('copy-and-paste', content),
  deleteItem: (id: number) => ipcRenderer.invoke('delete-item', id),
  clearHistory: () => ipcRenderer.invoke('clear-history'),
  togglePin: (id: number) => ipcRenderer.invoke('toggle-pin', id),
  hideWindow: () => ipcRenderer.invoke('hide-window'),
  getNativeTheme: () => ipcRenderer.invoke('get-native-theme'),
  setNativeTheme: (source: 'system' | 'dark' | 'light') => ipcRenderer.invoke('set-native-theme', source),

  onClipboardChanged: (cb: (content: string) => void) =>
    ipcRenderer.on('clipboard-changed', (_, content) => cb(content)),

  onClearHistoryRequest: (cb: () => void) =>
    ipcRenderer.on('clear-history-request', () => cb()),

  onNativeThemeChanged: (cb: (isDark: boolean) => void) =>
    ipcRenderer.on('native-theme-changed', (_, isDark) => cb(isDark)),
})
