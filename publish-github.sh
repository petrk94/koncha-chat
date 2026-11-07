#!/usr/bin/env bash
# Creates the public GitHub repository and pushes the local Koncha proof of concept.
# Run locally on a computer where GitHub CLI can authenticate your GitHub account.
set -euo pipefail

REPO="petrk94/koncha-chat"
ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"

if ! command -v gh >/dev/null 2>&1; then
  echo "GitHub CLI (gh) fehlt. Installiere es auf Ubuntu/Zorin mit: sudo apt install gh" >&2
  exit 1
fi
if ! command -v git >/dev/null 2>&1; then
  echo "Git fehlt. Installiere es mit: sudo apt install git" >&2
  exit 1
fi
if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "Kein Git-Repository gefunden. Entpacke das mitgelieferte ZIP vollständig, einschließlich .git/." >&2
  exit 1
fi
if [[ -n "$(git status --porcelain)" ]]; then
  echo "Lokale Änderungen gefunden. Veröffentlichung abgebrochen, um einen unvollständigen Stand zu vermeiden." >&2
  git status --short
  exit 1
fi

if ! gh auth status >/dev/null 2>&1; then
  echo "GitHub-Anmeldung erforderlich. Die GitHub CLI öffnet dafür einen Autorisierungsschritt."
  gh auth login --hostname github.com --git-protocol https --web
fi
ACTIVE_USER="$(gh api user --jq .login)"
if [[ "$ACTIVE_USER" != "petrk94" ]]; then
  echo "Angemeldetes GitHub-Konto: $ACTIVE_USER (erwartet: petrk94). Abbruch." >&2
  exit 1
fi
if gh repo view "$REPO" >/dev/null 2>&1; then
  echo "Repository https://github.com/$REPO existiert bereits. Kein Überschreiben durchgeführt." >&2
  exit 1
fi
if git remote get-url origin >/dev/null 2>&1; then
  echo "Remote origin ist bereits gesetzt; aus Sicherheitsgründen nicht automatisch ändern." >&2
  git remote -v
  exit 1
fi

printf '\nACHTUNG: Das Repository wird ÖFFENTLICH erstellt. Veröffentlichten Code können Dritte dauerhaft kopieren.\n'
printf 'Es dürfen keine Zugangsdaten, echten Chat-Nachrichten oder privaten Informationen enthalten sein.\n\n'

# The repo contains demo code only. GitHub CLI creates the empty repository,
# configures 'origin', then pushes the already committed main branch.
gh repo create "$REPO" \
  --public \
  --description "Koncha: privacy-first intercultural messenger proof of concept (not production secure)" \
  --source "$ROOT" \
  --remote origin \
  --push

echo
printf 'Fertig: https://github.com/%s\n' "$REPO"
printf 'Später privat stellen: gh repo edit %s --visibility private --accept-visibility-change-consequences\n' "$REPO"
