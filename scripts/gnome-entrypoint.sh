#!/usr/bin/env bash
set -Eeuo pipefail

readonly data_dir=/var/lib/maya-system
readonly disk_image="${DISK_IMAGE:-${data_dir}/debian-home.img}"
readonly disk_size="${DISK_SIZE:-32G}"
readonly vnc_display="${VNC_DISPLAY:-:1}"
readonly vnc_geometry="${VNC_GEOMETRY:-1600x1000}"
readonly vnc_depth="${VNC_DEPTH:-24}"
readonly vnc_password="${VNC_PASSWORD:-maya321}"
readonly mount_point=/home/maya
websockify_pid=""

cleanup() {
  trap - EXIT INT TERM
  runuser -u maya -- vncserver -kill "$vnc_display" >/dev/null 2>&1 || true
  if [[ -n "$websockify_pid" ]]; then
    kill "$websockify_pid" >/dev/null 2>&1 || true
    wait "$websockify_pid" 2>/dev/null || true
  fi
  if mountpoint --quiet "$mount_point"; then
    umount "$mount_point" || echo "Ostrzeżenie: nie udało się odmontować dysku 32 GB." >&2
  fi
}
trap cleanup EXIT INT TERM

mkdir -p "$data_dir" "$mount_point"
mkdir -p /run/dbus
if [[ ! -S /run/dbus/system_bus_socket ]]; then
  dbus-daemon --system --fork
fi
if ! busctl --system status org.freedesktop.login1 >/dev/null 2>&1; then
  /lib/systemd/systemd-logind &
fi

if [[ ! -e "$disk_image" ]]; then
  echo "Tworzenie wirtualnego dysku ${disk_size}..."
  truncate --size="$disk_size" "$disk_image"
fi

if [[ "$(blkid --output value --match-tag TYPE "$disk_image" 2>/dev/null || true)" != "ext4" ]]; then
  echo "Formatowanie wirtualnego dysku ext4..."
  mkfs.ext4 -F -L MAYA_HOME "$disk_image" >/dev/null
fi

if ! mountpoint --quiet "$mount_point"; then
  echo "Montowanie trwałego katalogu domowego 32 GB..."
  mount --options loop "$disk_image" "$mount_point"
fi

chown maya:maya "$mount_point"
install -d -m 0700 -o maya -g maya "$mount_point/.config" "$mount_point/.config/tigervnc"
install -d -m 0700 -o maya -g maya /run/user/1000
rm -f "$mount_point/.vnc/passwd" "$mount_point/.vnc/xstartup"
rmdir "$mount_point/.vnc" 2>/dev/null || true

install -d -o maya -g maya \
  "$mount_point/Pulpit" \
  "$mount_point/Dokumenty" \
  "$mount_point/Obrazy" \
  "$mount_point/Pobrane" \
  "$mount_point/Wideo" \
  "$mount_point/Muzyka" \
  "$mount_point/Projekt"

cat > "$mount_point/.config/tigervnc/xstartup" <<'EOF'
#!/bin/sh
unset SESSION_MANAGER
unset DBUS_SESSION_BUS_ADDRESS
export XDG_SESSION_TYPE=x11
export XDG_CURRENT_DESKTOP=GNOME
export XDG_SESSION_DESKTOP=gnome
export DESKTOP_SESSION=gnome
export LIBGL_ALWAYS_SOFTWARE=1
export XDG_RUNTIME_DIR=/run/user/1000
exec dbus-run-session -- gnome-session --session=gnome --disable-acceleration-check
EOF
chmod 0755 "$mount_point/.config/tigervnc/xstartup"
chown maya:maya "$mount_point/.config/tigervnc/xstartup"

printf '%s\n' "$vnc_password" | runuser -u maya -- vncpasswd -f > "$mount_point/.config/tigervnc/passwd"
chmod 0600 "$mount_point/.config/tigervnc/passwd"
chown maya:maya "$mount_point/.config/tigervnc/passwd"

runuser -u maya -- vncserver "$vnc_display" \
  -geometry "$vnc_geometry" \
  -depth "$vnc_depth" \
  -localhost no \
  -rfbauth "$mount_point/.config/tigervnc/passwd"

websockify \
  --web=/usr/share/novnc \
  --heartbeat=30 \
  6080 \
  127.0.0.1:5901 &
websockify_pid=$!

echo "Debian 13 GNOME jest dostępny pod http://localhost:6080/vnc.html"
echo "Użytkownik VNC: maya; hasło: wartość VNC_PASSWORD."
wait "$websockify_pid"
