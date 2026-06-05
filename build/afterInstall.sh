#!/bin/bash
# NOTE: set -e intentionally omitted — a failure in one section (e.g. icon
# cache, systemd launch) must not abort the rest of the post-install steps.

APP_BIN="/opt/clipboard-manager/clipboard-manager"
DESKTOP_SRC="/usr/share/applications/clipboard-manager.desktop"
AUTOSTART_DIR="/etc/xdg/autostart"
ICON_SRC="/opt/clipboard-manager/resources/icon-512.png"

# ── Install paste tools (wtype for Wayland, xdotool for X11) ─────────────
MISSING=""
command -v wtype   >/dev/null 2>&1 || MISSING="$MISSING wtype"
command -v xdotool >/dev/null 2>&1 || MISSING="$MISSING xdotool"

if [ -n "$MISSING" ]; then
    echo "Installing paste tools:$MISSING ..."
    apt-get update -qq || true
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
ln -sf "$APP_BIN" /usr/bin/clipboard-manager || true

# ── Patch --no-sandbox into the system .desktop file ─────────────────────
# The desktop template in package.json already includes --no-sandbox, but
# this sed is kept as a safety net for any electron-builder version that
# strips unknown Exec args from the template.
if [ -f "$DESKTOP_SRC" ]; then
    sed -i '/^Exec=/ { /--no-sandbox/! s|$| --no-sandbox| }' "$DESKTOP_SRC"
fi

# ── App icon → system icon theme (makes it show in GNOME Show Apps) ───────
if [ -f "$ICON_SRC" ]; then
    install -Dm644 "$ICON_SRC" \
        /usr/share/icons/hicolor/512x512/apps/clipboard-manager.png || true
    install -Dm644 "$ICON_SRC" \
        /usr/share/icons/hicolor/256x256/apps/clipboard-manager.png || true
    gtk-update-icon-cache /usr/share/icons/hicolor --force --quiet 2>/dev/null || true
fi

# ── XDG autostart (runs on every subsequent login) ────────────────────────
mkdir -p "$AUTOSTART_DIR"
cat > "$AUTOSTART_DIR/clipboard-manager.desktop" << 'EOF'
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
chmod 644 "$AUTOSTART_DIR/clipboard-manager.desktop"

# ── Start app immediately in the current user's desktop session ───────────
# Detect the real desktop user (SUDO_USER set by pkexec/GNOME Software,
# logname/who as fallback for terminal installs).
CURRENT_USER="${SUDO_USER:-$(logname 2>/dev/null || who | awk 'NR==1{print $1}' || echo "")}"

if [ -n "$CURRENT_USER" ] && [ "$CURRENT_USER" != "root" ]; then
    USER_ID=$(id -u "$CURRENT_USER" 2>/dev/null || echo "")
    if [ -n "$USER_ID" ]; then
        # Try systemd-run first (cleanest — inherits the user's full session env).
        if systemd-run \
            --user \
            --machine="${CURRENT_USER}@.host" \
            --unit=clipboard-manager-launch \
            --description="Clipboard Manager (post-install launch)" \
            "$APP_BIN" --no-sandbox --autostart \
            >/dev/null 2>&1; then
            echo "Clipboard Manager started."
        else
            # Fallback: su into the user and launch with the display env manually.
            WAYLAND_SOCK="/run/user/$USER_ID/wayland-0"
            su -c "
                export XDG_RUNTIME_DIR=/run/user/$USER_ID
                export DBUS_SESSION_BUS_ADDRESS=unix:path=/run/user/$USER_ID/bus
                if [ -S \"$WAYLAND_SOCK\" ]; then
                    export WAYLAND_DISPLAY=wayland-0
                else
                    export DISPLAY=:0
                fi
                nohup \"$APP_BIN\" --no-sandbox --autostart \
                    >/tmp/clipboard-manager-start.log 2>&1 &
            " "$CURRENT_USER" || true
        fi
    fi
fi
