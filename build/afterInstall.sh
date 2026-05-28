#!/bin/bash
set -e

# ── Install paste tools (wtype for Wayland, xdotool for X11) ─────────────
MISSING=""
command -v wtype   >/dev/null 2>&1 || MISSING="$MISSING wtype"
command -v xdotool >/dev/null 2>&1 || MISSING="$MISSING xdotool"

if [ -n "$MISSING" ]; then
    echo "Installing paste tools:$MISSING ..."
    apt-get install -y --no-install-recommends $MISSING 2>/dev/null || \
        echo "Warning: could not auto-install$MISSING — paste simulation may not work."
fi

echo ""
echo "┌─────────────────────────────────────────────────────────────────┐"
echo "│              Clipboard Manager successfully installed            │"
echo "│                                                                 │"
echo "│  Shortcut : Super + Shift + V                                   │"
echo "│  Paste    : wtype (Wayland) and xdotool (X11) installed         │"
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
# Chromium's sandbox check to abort before any JS runs. Patching it here
# ensures GNOME Show Apps launches with the flag present.
DESKTOP_FILE="/usr/share/applications/clipboard-manager.desktop"
if [ -f "$DESKTOP_FILE" ]; then
    sed -i 's|^Exec=\(.*clipboard-manager\) *\(%U\)\?$|Exec=\1 --no-sandbox \2|' "$DESKTOP_FILE"
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
X-GNOME-Autostart-Delay=3
EOF
chmod 644 /etc/xdg/autostart/clipboard-manager.desktop

# ── Start app immediately in the current user's desktop session ───────────
CURRENT_USER=$(logname 2>/dev/null || who | awk 'NR==1{print $1}' || echo "")
if [ -n "$CURRENT_USER" ]; then
    USER_ID=$(id -u "$CURRENT_USER" 2>/dev/null || echo "")
    if [ -n "$USER_ID" ]; then
        su -c "
            export DISPLAY=:0
            export XDG_RUNTIME_DIR=/run/user/$USER_ID
            export DBUS_SESSION_BUS_ADDRESS=unix:path=/run/user/$USER_ID/bus
            nohup /opt/clipboard-manager/clipboard-manager --no-sandbox --autostart >/dev/null 2>&1 &
        " "$CURRENT_USER" || true
    fi
fi
