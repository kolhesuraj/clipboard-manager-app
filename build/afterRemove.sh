#!/bin/bash
rm -f /etc/xdg/autostart/clipboard-manager.desktop
rm -f /usr/bin/clipboard-manager
rm -f /usr/share/icons/hicolor/512x512/apps/clipboard-manager.png
rm -f /usr/share/icons/hicolor/256x256/apps/clipboard-manager.png
gtk-update-icon-cache /usr/share/icons/hicolor --force --quiet 2>/dev/null || true
