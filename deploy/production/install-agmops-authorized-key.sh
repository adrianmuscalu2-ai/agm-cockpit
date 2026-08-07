#!/usr/bin/env bash
set -euo pipefail

public_key_file="${1:?public key file required}"
mount_point="/mnt"
root_devices="$(lsblk -rno PATH,TYPE,FSTYPE | awk '$2 == "part" && $3 ~ /^(ext[234]|xfs)$/ {print $1}')"
[[ "$(printf '%s\n' "$root_devices" | sed '/^$/d' | wc -l)" -eq 1 ]]
[[ "$root_devices" == "/dev/sda1" ]]

mount "$root_devices" "$mount_point"
trap 'sync; umount "$mount_point" 2>/dev/null || true' EXIT
[[ -d "$mount_point/etc" ]]
[[ -d "$mount_point/home/agmops" ]]

key="$(tr -d '\r\n' < "$public_key_file")"
[[ "$key" == ssh-ed25519\ * ]]
install -d -m 700 "$mount_point/home/agmops/.ssh"
touch "$mount_point/home/agmops/.ssh/authorized_keys"
grep -qxF "$key" "$mount_point/home/agmops/.ssh/authorized_keys" || printf '%s\n' "$key" >> "$mount_point/home/agmops/.ssh/authorized_keys"
chown -R --reference="$mount_point/home/agmops" "$mount_point/home/agmops/.ssh"
chmod 700 "$mount_point/home/agmops/.ssh"
chmod 600 "$mount_point/home/agmops/.ssh/authorized_keys"
grep -qxF "$key" "$mount_point/home/agmops/.ssh/authorized_keys"
echo 'AGMOPS_AUTHORIZED_KEY_INSTALLATION_PASS'
