#!/usr/bin/env bash
set -euo pipefail
# Generate outside your public web root. Do not paste or commit the private key.
TARGET="${1:-$HOME/.config/koncha/vapid-private.pem}"
if [[ -e "$TARGET" ]]; then echo 'Key already exists; refusing to overwrite.' >&2; exit 1; fi
mkdir -p "$(dirname "$TARGET")"
umask 077
openssl ecparam -name prime256v1 -genkey -noout -out "$TARGET"
chmod 600 "$TARGET"
printf 'VAPID private key written to: %s\n' "$TARGET"
printf 'Configure KONCHA_VAPID_PRIVATE_KEY_FILE and KONCHA_VAPID_SUBJECT=mailto:you@example.org in PHP environment.\n'
