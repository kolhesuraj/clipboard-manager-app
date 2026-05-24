# Clipboard Manager

A lightweight, keyboard-driven clipboard history manager for Linux (GNOME/Wayland).  
Press **Super+Shift+V** to instantly browse and paste anything you've copied — in any app, including native Wayland apps and terminal emulators.

---

## Features

- **Keyboard-first** — open with Super+Shift+V from anywhere, no mouse needed
- **Auto-paste** — clicking an item copies it and simulates Ctrl+V (or Ctrl+Shift+V in terminals) automatically
- **Terminal-aware** — detects whether a terminal was focused and uses the right paste shortcut
- **Native Wayland support** — uses Mutter RemoteDesktop D-Bus for key injection (works in all GNOME Wayland apps)
- **100-item history** — keeps your last 100 clipboard entries, unpinned items rotate out automatically
- **Pin items** — pin important entries so they never get evicted
- **Search** — fuzzy-filter history as you type
- **System tray icon** — always running in the background, always ready
- **Zero port conflicts** — communicates via a Unix socket, not a TCP port

---

## Requirements

- Linux with GNOME (Wayland or XWayland)
- Node.js 18+ and npm
- `python3` with `dbus-python` (`pip install dbus-python` or `sudo apt install python3-dbus`)
- `xprop` (`sudo apt install x11-utils`)
- `wl-clipboard` (`sudo apt install wl-clipboard`) for Wayland clipboard write
- `curl` (for the GNOME system shortcut trigger)

---

## Installation

```bash
# Clone the repo
git clone https://github.com/kolhesuraj/clipboard-manager-app.git
cd clipboard-manager-app

# Install dependencies (also rebuilds native modules for Electron)
npm install

# Build
npm run build
```

---

## Running

```bash
cd app
npm start
```

The app starts minimized to the system tray. The GNOME shortcut **Super+Shift+V** is registered automatically on first launch — no manual setup required.

---

## Usage

| Action | How |
|---|---|
| Open clipboard history | **Super+Shift+V** |
| Close | **Esc** or click outside |
| Paste an item | Click it — auto-pastes into the previously focused app |
| Pin / unpin | Click the pin icon on any item |
| Delete item | Click the trash icon |
| Search | Type in the search bar at the top |
| Clear all history | Click "Clear" in the top bar |

---

## Development

```bash
cd app
npm run dev   # starts Electron + Vite HMR in development mode
```

---

## Project Structure

```
clipboard-manager/
├── app/                    # Electron application
│   ├── src/
│   │   ├── main/           # Main process (Node/Electron)
│   │   │   ├── index.ts        # App entry, IPC handlers, shortcut registration
│   │   │   ├── clipboard.ts    # Clipboard watcher
│   │   │   ├── database.ts     # SQLite history store
│   │   │   ├── paste.ts        # Paste simulation (xdotool / Mutter / wtype)
│   │   │   ├── trigger-server.ts # Unix socket HTTP server (toggle/show/hide)
│   │   │   └── tray.ts         # System tray
│   │   ├── preload/        # Preload bridge (contextBridge)
│   │   └── renderer/       # React UI
│   └── package.json
├── website/                # Landing page
├── README.md
└── CONTRIBUTING.md
```

---

## How It Works

1. A background clipboard watcher polls for new content and saves it to a local SQLite database.
2. When you press **Super+Shift+V**, GNOME fires `curl --unix-socket <socket> http://localhost/toggle`, which the app's Unix socket server receives.
3. The app records whether the previously focused window was a terminal (via `xprop _NET_ACTIVE_WINDOW` + WM_CLASS).
4. The clipboard manager window opens near your cursor.
5. When you click an item, the app writes it to the clipboard, hides the window, waits 500 ms for focus to return, then simulates the correct paste keystroke via the Mutter RemoteDesktop D-Bus API.

---

## License

MIT
