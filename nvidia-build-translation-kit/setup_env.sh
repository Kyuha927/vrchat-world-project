#!/usr/bin/env bash
set -euo pipefail

read -r -s -p "NVIDIA_API_KEY: " NVIDIA_API_KEY
echo

if [ "${#NVIDIA_API_KEY}" -lt 10 ]; then
  echo "API key is empty or too short." >&2
  exit 1
fi

profile="${HOME}/.profile"
grep -v '^export NVIDIA_API_KEY=' "$profile" 2>/dev/null > "${profile}.tmp" || true
printf "export NVIDIA_API_KEY='%s'\n" "$NVIDIA_API_KEY" >> "${profile}.tmp"
mv "${profile}.tmp" "$profile"
chmod 600 "$profile"
echo "Saved NVIDIA_API_KEY to $profile. Run: source $profile"
