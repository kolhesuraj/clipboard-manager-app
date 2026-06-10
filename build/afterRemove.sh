#!/bin/bash

# Kill any running instances of the app in all user sessions.
pkill -f "/opt/clipboard-manager/clipboard-manager" 2>/dev/null || true

# Stop and disable ydotoold for every logged-in user.
while IFS= read -r USERNAME; do
    UID_VAL=$(id -u "$USERNAME" 2>/dev/null) || continue
    [ -z "$UID_VAL" ] && continue
    XDG="XDG_RUNTIME_DIR=/run/user/$UID_VAL"
    DBUS="DBUS_SESSION_BUS_ADDRESS=unix:path=/run/user/$UID_VAL/bus"
    su - "$USERNAME" -c "$XDG $DBUS systemctl --user disable --now ydotoold 2>/dev/null || true" \
        >/dev/null 2>&1 || true
done < <(who | awk '{print $1}' | sort -u)

# Remove installed files.
rm -f /etc/xdg/autostart/clipboard-manager.desktop
rm -f /usr/bin/clipboard-manager
rm -f /usr/share/icons/hicolor/512x512/apps/clipboard-manager.png
rm -f /usr/share/icons/hicolor/256x256/apps/clipboard-manager.png
rm -f /etc/udev/rules.d/60-ydotool.rules
rm -f /etc/systemd/user/ydotoold.service
rm -f /usr/lib/systemd/user/ydotoold.service

gtk-update-icon-cache /usr/share/icons/hicolor --force --quiet 2>/dev/null || true
udevadm control --reload-rules 2>/dev/null || true
