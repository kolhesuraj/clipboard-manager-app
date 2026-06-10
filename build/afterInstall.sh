#!/bin/bash
# NOTE: set -e intentionally omitted — a failure in one section (e.g. icon
# cache, systemd launch) must not abort the rest of the post-install steps.

APP_BIN="/opt/clipboard-manager/clipboard-manager"
DESKTOP_SRC="/usr/share/applications/clipboard-manager.desktop"
AUTOSTART_DIR="/etc/xdg/autostart"
ICON_SRC="/opt/clipboard-manager/resources/icon-512.png"

# Detect the real desktop user early — used throughout this script.
# SUDO_USER is set by sudo/pkexec/GNOME Software; logname/who cover terminals.
CURRENT_USER="${SUDO_USER:-$(logname 2>/dev/null || true)}"
if [ -z "$CURRENT_USER" ] || [ "$CURRENT_USER" = "root" ]; then
    CURRENT_USER=$(who | grep -v root | awk 'NR==1{print $1}')
fi
USER_ID=$(id -u "$CURRENT_USER" 2>/dev/null || echo "")

# ── Safety net: ensure ydotool is present ────────────────────────────────
if ! command -v ydotool >/dev/null 2>&1; then
    echo "Installing ydotool ..."
    apt-get update -qq || true
    apt-get install -y --no-install-recommends ydotool || \
        echo "Warning: could not install ydotool — paste simulation may not work."
fi

# ── ydotool: udev rule + systemd user service ─────────────────────────────
# ydotool uses /dev/uinput (kernel level) — bypasses Wayland compositor
# restrictions that block wtype on GNOME 45+.
# The udev rule makes /dev/uinput world-writable so ydotoold works
# immediately without the user needing to be in the input group.
if command -v ydotool >/dev/null 2>&1; then

    # 1. udev rule: MODE=0666 so any user can open /dev/uinput.
    cat > /etc/udev/rules.d/60-ydotool.rules << 'UDEV_EOF'
KERNEL=="uinput", MODE="0666", OPTIONS+="static_node=uinput"
UDEV_EOF
    udevadm control --reload-rules 2>/dev/null || true
    udevadm trigger --name-match=uinput 2>/dev/null || true
    # Direct chmod as belt-and-suspenders — udevadm trigger does not always
    # update an already-created device node on the running kernel.
    chmod 0666 /dev/uinput 2>/dev/null || true

    # 2. Write ydotoold service with --socket-path %t/ydotool.
    #    %t expands to $XDG_RUNTIME_DIR (/run/user/{uid}) in user units —
    #    exactly the path the app checks. Write to both dirs for compatibility.
    for SVC_DIR in /etc/systemd/user /usr/lib/systemd/user; do
        [ -d "$SVC_DIR" ] || mkdir -p "$SVC_DIR"
        cat > "$SVC_DIR/ydotoold.service" << 'SVC_EOF'
[Unit]
Description=ydotool daemon
After=basic.target

[Service]
ExecStart=/usr/bin/ydotoold --socket-path %t/ydotool
Restart=on-failure

[Install]
WantedBy=default.target
SVC_EOF
    done

    # 3. Enable and start daemon for the current user without requiring logout.
    if [ -n "$CURRENT_USER" ] && [ "$CURRENT_USER" != "root" ] && [ -n "$USER_ID" ]; then
        XRDP="XDG_RUNTIME_DIR=/run/user/$USER_ID"
        DBUS="DBUS_SESSION_BUS_ADDRESS=unix:path=/run/user/$USER_ID/bus"

        # daemon-reload so systemd picks up the new service file.
        systemd-run --user --machine="${CURRENT_USER}@.host" \
            systemctl --user daemon-reload >/dev/null 2>&1 || \
        su - "$CURRENT_USER" -c "$XRDP $DBUS systemctl --user daemon-reload" \
            >/dev/null 2>&1 || true

        # enable (persists across reboots) + start now.
        systemd-run --user --machine="${CURRENT_USER}@.host" \
            systemctl --user enable --now ydotoold >/dev/null 2>&1 || \
        su - "$CURRENT_USER" -c "
            $XRDP $DBUS systemctl --user enable ydotoold 2>/dev/null || true
            $XRDP $DBUS systemctl --user start  ydotoold 2>/dev/null || \
                nohup /usr/bin/ydotoold --socket-path /run/user/$USER_ID/ydotool \
                    >/tmp/ydotoold.log 2>&1 &
        " >/dev/null 2>&1 || \
        su "$CURRENT_USER" -c \
            "nohup /usr/bin/ydotoold --socket-path /run/user/$USER_ID/ydotool \
                >/tmp/ydotoold.log 2>&1 &" >/dev/null 2>&1 || \
        nohup /usr/bin/ydotoold \
            --socket-path "/run/user/$USER_ID/ydotool" \
            --socket-perm 0666 \
            >/tmp/ydotoold.log 2>&1 &
    fi
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
if [ -f "$DESKTOP_SRC" ]; then
    sed -i '/^Exec=/ { /--no-sandbox/! s|$| --no-sandbox| }' "$DESKTOP_SRC"
fi

# ── App icon → system icon theme ─────────────────────────────────────────
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
if [ -n "$CURRENT_USER" ] && [ "$CURRENT_USER" != "root" ] && [ -n "$USER_ID" ]; then
    # Wait up to 3 s for ydotoold socket so the app finds it on first paste.
    for _i in 1 2 3 4 5 6; do
        [ -S "/run/user/$USER_ID/ydotool" ] && break
        sleep 0.5
    done

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
        # Fallback: su into the user with explicit display env.
        WAYLAND_SOCK="/run/user/$USER_ID/wayland-0"
        su - "$CURRENT_USER" -c "
            export XDG_RUNTIME_DIR=/run/user/$USER_ID
            export DBUS_SESSION_BUS_ADDRESS=unix:path=/run/user/$USER_ID/bus
            if [ -S '$WAYLAND_SOCK' ]; then
                export WAYLAND_DISPLAY=wayland-0
            else
                export DISPLAY=\${DISPLAY:-:0}
            fi
            nohup '$APP_BIN' --no-sandbox --autostart \
                >/tmp/clipboard-manager-start.log 2>&1 &
        " || true
    fi
fi
