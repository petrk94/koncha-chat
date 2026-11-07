#!/usr/bin/env bash
set -euo pipefail
root="$(git rev-parse --show-toplevel 2>/dev/null || true)"
if [[ -z "$root" ]]; then echo 'Nicht innerhalb eines Git-Repositories.' >&2; exit 1; fi
printf '\nKoncha – lokale Arbeitskopie\n'
printf 'Ordner: %s\n' "$root"
printf 'Branch: %s\n' "$(git -C "$root" branch --show-current)"
printf 'Letzter Commit: %s\n' "$(git -C "$root" log -1 --format='%h %cs %s')"
printf '\nGit-Status:\n'
git -C "$root" status -sb
printf '\nRemotes:\n'
git -C "$root" remote -v || true
printf '\nVerfügbare Release-Version:\n'
node -p "require('$root/package.json').version" 2>/dev/null || grep -m1 '"version"' "$root/package.json"
printf '\nRuntime-Raumdateien (werden NICHT committed): '
find "$root/var/rooms" -maxdepth 1 -type f -name '*.json' 2>/dev/null | wc -l
printf 'Prüfe .gitignore für var/rooms/:\n'
git -C "$root" check-ignore -v var/rooms/sample.json || true
printf '\nPR-Status bei GitHub (falls gh verfügbar):\n'
if command -v gh >/dev/null 2>&1; then gh pr status -R petrk94/koncha-chat || true; else echo 'GitHub CLI gh nicht installiert'; fi
