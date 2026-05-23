# Linux Clipboard Manager App Guide

## Goal

Build a Linux clipboard manager application that:

- Watches clipboard changes
- Stores clipboard history
- Allows searching old clipboard items
- Supports quick paste/copy
- Runs in the background
- Supports global shortcuts
- Integrates with Linux system tray

---

# Recommended Tech Stack

## Best Stack for You

Since you already work with:

- Node.js
- React
- TypeScript

The best starting stack is:

- Electron
- React
- TypeScript
- SQLite

---

# Why Electron?

## Pros

- Fast development
- Huge ecosystem
- Cross-platform
- Easy clipboard APIs
- Easy tray support
- Easy global shortcuts

## Cons

- Higher memory usage

Still the best option for MVP.

---

# Alternative: Tauri

Tauri uses:

- Rust backend
- React frontend

## Pros

- Very lightweight
- Native performance
- Small application size

## Cons

- More complex
- Requires Rust knowledge

Recommended after MVP.

---

# Linux Clipboard Basics

Linux has two clipboard systems:

## PRIMARY

Selected text clipboard.

Middle-click paste behavior.

## CLIPBOARD

Normal Ctrl+C / Ctrl+V clipboard.

Most applications use this.

---

# X11 vs Wayland

## X11

Older display system.

Clipboard monitoring is easy.

Useful tools:

- xclip
- xsel

## Wayland

Modern Linux display system.

More secure.

Clipboard access is restricted.

Useful tools:

- wl-clipboard
- wl-paste

Wayland support requires extra handling.

---

# Recommended Architecture

```text
┌────────────────────┐
│ Background Service │
│ watches clipboard  │
└─────────┬──────────┘
          │
          ▼
┌────────────────────┐
│ SQLite Database    │
│ clipboard history  │
└─────────┬──────────┘
          │
          ▼
┌────────────────────┐
│ Searchable UI      │
│ tray + shortcuts   │
└────────────────────┘