#!/bin/bash
set -e

# ── Install paste tools (wtype for Wayland, xdotool for X11) ─────────────
MISSING=""
command -v wtype   >/dev/null 2>&1 || MISSING="$MISSING wtype"
command -v xdotool >/dev/null 2>&1 || MISSING="$MISSING xdotool"

if [ -n "$MISSING" ]; then
    echo "Installing paste tools:$MISSING ..."
    apt-get update -qq || true   # non-fatal: stale cache is fine, install may still succeed
    apt-get install -y --no-install-recommends $MISSING || \
        echo "Warning: could not auto-install$MISSING — paste simulation may not work."
fi

echo ""
echo "┌─────────────────────────────────────────────────────────────────┐"
echo "│              Clipboard Manager successfully installed            │"
echo "│                                                                 │"
echo "│  Shortcut : Super + Shift + V                                   │"
echo "│  Terminal : clipboard-manager                                   │"
echo "│  Autostart: enabled — app will start on next login              │"
echo "│                                                                 │"
echo "│  NOTE: GNOME users — if the shortcut does not work, open        │"
echo "│  Settings › Keyboard › Shortcuts and check for conflicts.       │"
echo "└─────────────────────────────────────────────────────────────────┘"
echo ""

# ── /usr/bin symlink ──────────────────────────────────────────────────────
ln -sf /opt/clipboard-manager/clipboard-manager /usr/bin/clipboard-manager

# ── Patch --no-sandbox into the system .desktop file ─────────────────────
# electron-builder generates the Exec line without --no-sandbox, which causes
# Chromium's sandbox check to abort before any JS runs. The old pattern
# assumed Exec ended with %U which is not always the case; this version
# appends --no-sandbox to any Exec= line that doesn't already have it.
DESKTOP_FILE="/usr/share/applications/clipboard-manager.desktop"
if [ -f "$DESKTOP_FILE" ]; then
    sed -i '/^Exec=/ { /--no-sandbox/! s|$| --no-sandbox| }' "$DESKTOP_FILE"
fi

# ── App icon → system icon theme (makes it show in GNOME Show Apps) ───────
install -Dm644 /opt/clipboard-manager/resources/icon-512.png \
    /usr/share/icons/hicolor/512x512/apps/clipboard-manager.png
install -Dm644 /opt/clipboard-manager/resources/icon-512.png \
    /usr/share/icons/hicolor/256x256/apps/clipboard-manager.png
gtk-update-icon-cache /usr/share/icons/hicolor --force --quiet 2>/dev/null || true

# ── XDG autostart (runs on every subsequent login) ────────────────────────
mkdir -p /etc/xdg/autostart
cat > /etc/xdg/autostart/clipboard-manager.desktop << 'EOF'
[Desktop Entry]
Version=1.0
Type=Application
Name=Clipboard Manager
Comment=Fast clipboard history manager for Linux
Exec=/opt/clipboard-manager/clipboard-manager --no-sandbox --autostart
Icon=clipboard-manager
Hidden=false
NoDisplay=false
X-GNOME-Autostart-enabled=true
X-GNOME-Autostart-Delay=4
EOF
chmod 644 /etc/xdg/autostart/clipboard-manager.desktop

# ── Start app immediately in the current user's desktop session ───────────
# SUDO_USER is set when installed via sudo or pkexec (GNOME Software uses
# pkexec), so it correctly identifies the real user even during a root install.
# logname/who is the fallback for plain terminal installs.
CURRENT_USER="${SUDO_USER:-$(logname 2>/dev/null || who | awk 'NR==1{print $1}' || echo "")}"
if [ -n "$CURRENT_USER" ] && [ "$CURRENT_USER" != "root" ]; then
    USER_ID=$(id -u "$CURRENT_USER" 2>/dev/null || echo "")
    if [ -n "$USER_ID" ]; then
        # Detect Wayland or X11 session and set the right display variable.
        WAYLAND_SOCK="/run/user/$USER_ID/wayland-0"
        su -c "
            export XDG_RUNTIME_DIR=/run/user/$USER_ID
            export DBUS_SESSION_BUS_ADDRESS=unix:path=/run/user/$USER_ID/bus
            if [ -S \"$WAYLAND_SOCK\" ]; then
                export WAYLAND_DISPLAY=wayland-0
            else
                export DISPLAY=:0
            fi
            nohup /opt/clipboard-manager/clipboard-manager --no-sandbox --autostart \
                >/tmp/clipboard-manager-start.log 2>&1 &
        " "$CURRENT_USER" || true
    fi
fi
