#!/bin/bash
rm -f /etc/xdg/autostart/clipboard-manager.desktop
rm -f /usr/bin/clipboard-manager
rm -f /usr/share/icons/hicolor/512x512/apps/clipboard-manager.png
rm -f /usr/share/icons/hicolor/256x256/apps/clipboard-manager.png
rm -f /etc/udev/rules.d/60-ydotool.rules
rm -f /etc/systemd/user/ydotoold.service
gtk-update-icon-cache /usr/share/icons/hicolor --force --quiet 2>/dev/null || true
udevadm control --reload-rules 2>/dev/null || true
