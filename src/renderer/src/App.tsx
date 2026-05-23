import { useState, useEffect, useCallback } from 'react'
import SearchBar from './components/SearchBar.tsx'
import ClipboardList from './components/ClipboardList.tsx'
import './App.css'

export interface ClipboardItem {
  id: number
  content: string
  content_type: string
  created_at: number
  pinned: number
}

declare global {
  interface Window {
    electronAPI: {
      getItems: (search: string) => Promise<ClipboardItem[]>
      copyItem: (content: string) => Promise<boolean>
      copyAndPaste: (content: string) => Promise<boolean>
      deleteItem: (id: number) => Promise<boolean>
      clearHistory: () => Promise<boolean>
      togglePin: (id: number) => Promise<boolean>
      hideWindow: () => Promise<void>
      getNativeTheme: () => Promise<boolean>
      setNativeTheme: (source: 'system' | 'dark' | 'light') => Promise<void>
      onClipboardChanged: (cb: (content: string) => void) => void
      onClearHistoryRequest: (cb: () => void) => void
      onNativeThemeChanged: (cb: (isDark: boolean) => void) => void
      onPasteToolMissing: (cb: () => void) => void
      checkPasteTool: () => Promise<{ silent: boolean; mutterAllowed: boolean }>
      setMutterConsent: (value: boolean) => Promise<void>
    }
  }
}

type ThemePref = 'system' | 'dark' | 'light'

function applyTheme(pref: ThemePref, systemIsDark: boolean) {
  const isDark = pref === 'system' ? systemIsDark : pref === 'dark'
  document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light')
}

export default function App() {
  const [items, setItems] = useState<ClipboardItem[]>([])
  const [search, setSearch] = useState('')
  const [themePref, setThemePref] = useState<ThemePref>('system')
  const [systemIsDark, setSystemIsDark] = useState(true)
  const [toast, setToast] = useState(false)
  const [warning, setWarning] = useState(false)

  const load = useCallback(
    async (q = search) => setItems(await window.electronAPI.getItems(q)),
    [search]
  )

  useEffect(() => {
    window.electronAPI.getNativeTheme().then((isDark) => {
      setSystemIsDark(isDark)
      applyTheme('system', isDark)
    })
    window.electronAPI.onNativeThemeChanged((isDark) => {
      setSystemIsDark(isDark)
      setThemePref((prev) => { applyTheme(prev, isDark); return prev })
    })
  }, [])

  useEffect(() => {
    applyTheme(themePref, systemIsDark)
  }, [themePref, systemIsDark])

  useEffect(() => {
    load('')
    window.electronAPI.onClipboardChanged(() => load())
    window.electronAPI.checkPasteTool().then(({ silent, mutterAllowed }) => {
      if (!silent && !mutterAllowed) setWarning(true)
    })
    window.electronAPI.onPasteToolMissing(() => {
      setToast(true)
      setTimeout(() => setToast(false), 5000)
    })
    window.electronAPI.onClearHistoryRequest(async () => {
      await window.electronAPI.clearHistory()
      load('')
    })

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') window.electronAPI.hideWindow()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [load])

  const cycleTheme = () => {
    const next: ThemePref = themePref === 'system' ? 'dark' : themePref === 'dark' ? 'light' : 'system'
    setThemePref(next)
    window.electronAPI.setNativeTheme(next)
  }

  const themeIcon = themePref === 'dark' ? '🌙' : themePref === 'light' ? '☀️' : '⚙️'

  const handleSearch = (q: string) => {
    setSearch(q)
    load(q)
  }

  const handleCopy = async (content: string) => {
    await window.electronAPI.copyAndPaste(content)
  }

  const handleDelete = async (id: number) => {
    await window.electronAPI.deleteItem(id)
    load()
  }

  const handlePin = async (id: number) => {
    await window.electronAPI.togglePin(id)
    load()
  }

  const handleClearAll = async () => {
    await window.electronAPI.clearHistory()
    setSearch('')
    load('')
  }

  const handleAllowMutter = async () => {
    await window.electronAPI.setMutterConsent(true)
    setWarning(false)
  }

  return (
    <div className="app">
      <header className="header">
        <div className="header-logo">
          <svg width="20" height="20" viewBox="0 0 28 28" fill="none" aria-hidden="true">
            <rect width="28" height="28" rx="7" fill="#6366f1" />
            <path d="M8 9h12M8 13h12M8 17h8" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
          </svg>
          Clipboard Manager
        </div>
        <div className="header-actions">
          <button className="btn-theme" onClick={cycleTheme} title={`Theme: ${themePref}`}>
            {themeIcon}
          </button>
          <button className="btn-clear" onClick={handleClearAll} title="Clear unpinned history">
            Clear
          </button>
        </div>
      </header>

      {warning && (
        <div className="warning-banner">
          <div className="warning-banner-row">
            <span>⚠️ Auto-paste unavailable — wtype/xdotool not found</span>
            <button className="warning-dismiss" onClick={() => setWarning(false)}>✕</button>
          </div>
          <div className="warning-banner-options">
            <button className="warning-allow" onClick={handleAllowMutter}>
              Allow via screen recording
            </button>
            <span className="warning-or">or install silently:</span>
          </div>
          <div className="warning-banner-cmd">
            <code>sudo apt install wtype</code>
            <button className="toast-copy" onClick={() => navigator.clipboard.writeText('sudo apt install wtype')}>Copy</button>
          </div>
          <div className="warning-note">Screen recording method briefly shows the indicator</div>
        </div>
      )}

      <SearchBar value={search} onChange={handleSearch} />

      <ClipboardList
        items={items}
        onCopy={handleCopy}
        onDelete={handleDelete}
        onPin={handlePin}
      />

      <footer className="footer">
        {items.length} item{items.length !== 1 ? 's' : ''}&nbsp;·&nbsp;
        Super+Shift+V to toggle&nbsp;·&nbsp;Esc to close
      </footer>

      {toast && (
        <div className="toast-error">
          <span>⚠️ Copied — paste manually with Ctrl+V</span>
          <div className="toast-hint">
            <code>sudo apt install wtype</code>
            <button
              className="toast-copy"
              onClick={() => navigator.clipboard.writeText('sudo apt install wtype')}
              title="Copy command"
            >
              Copy
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
