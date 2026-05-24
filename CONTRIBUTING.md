# Contributing

Thank you for your interest in contributing! This document covers everything you need to get started.

---

## Development Setup

```bash
git clone https://github.com/kolhesuraj/clipboard-manager-app.git
cd clipboard-manager-app
npm install
npm run dev
```

`npm run dev` starts Electron with Vite HMR — the renderer reloads on every file save, and you can open DevTools from the tray menu.

---

## Project Layout

```
app/src/
├── main/
│   ├── index.ts          # App bootstrap, IPC handlers, globalShortcut, GNOME shortcut registration
│   ├── clipboard.ts      # Polling-based clipboard watcher
│   ├── database.ts       # SQLite via better-sqlite3 (history, pin, search)
│   ├── paste.ts          # Terminal detection + paste simulation (xdotool / Mutter D-Bus / wtype)
│   ├── trigger-server.ts # Unix socket HTTP server (/toggle, /show, /hide)
│   └── tray.ts           # System tray icon + menu
├── preload/
│   └── index.ts          # contextBridge — exposes safe IPC to renderer
└── renderer/src/
    ├── App.tsx            # Root component, IPC calls
    └── components/        # ClipboardItem, ClipboardList, SearchBar
```

---

## Architecture Notes

### Paste simulation

Paste is attempted in order: **xdotool** → **Mutter RemoteDesktop D-Bus** → **wtype**.  
Mutter D-Bus is the most reliable on GNOME Wayland and works even for native Wayland apps.  
All three paths are async — never use `spawnSync` here (it blocks Electron's event loop).

### Terminal detection

`isTerminalFocused()` in `paste.ts` reads `_NET_ACTIVE_WINDOW` via `xprop` **before** the clipboard manager window opens (while the target app still has focus). If the active window ID is `0x0` (native Wayland app), it falls back to `pgrep gnome-terminal-`. This must be called at toggle time, not at paste time.

### Clipboard write

`wl-copy` stays alive as a clipboard server and never exits — always use async `spawn` with `detached: true` and `proc.unref()`. Never `spawnSync('wl-copy', ...)`.

### Unix socket

The trigger server listens on a Unix socket at `app.getPath('userData')/trigger.sock`. The GNOME shortcut fires `curl --unix-socket <path> http://localhost/toggle`. No TCP port is used.

---

## Making Changes

1. **Fork** the repository and create a feature branch: `git checkout -b feat/my-change`
2. Make your changes in `clipboard-manager-app/src/`
3. Run `npm run build` to verify the build passes
4. Test manually — open the app, trigger the shortcut, paste into both a terminal and a text editor
5. Open a pull request against `main`

---

## Pull Request Checklist

- [ ] `npm run build` passes without errors
- [ ] Paste works in a standard text editor (Ctrl+V path)
- [ ] Paste works in a terminal emulator (Ctrl+Shift+V path)
- [ ] No `spawnSync` calls in paste or clipboard write paths
- [ ] No new TCP ports introduced — use the existing Unix socket

---

## Reporting Bugs

Please open a GitHub issue with:

- Your Linux distro and GNOME version (`gnome-shell --version`)
- Whether you are on Wayland or X11 (`echo $XDG_SESSION_TYPE`)
- Steps to reproduce
- The Electron console output (start the app from a terminal to see logs)

---

## Code Style

- TypeScript strict mode is enabled
- Double quotes, semicolons (enforced by the existing tsconfig)
- No comments unless the *why* is non-obvious
- Keep main-process code synchronous-free in hot paths
