#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
repo='petrk94/koncha-chat'
branch='feat/device-identity-multiroom-presence'
[[ "$(git branch --show-current)" == "$branch" ]] || { echo "Erwarteter Branch: $branch" >&2; exit 1; }
[[ -z "$(git status --porcelain)" ]] || { echo 'Uncommittete Dateien: erst git status prüfen.' >&2; exit 1; }
command -v gh >/dev/null || { echo 'Bitte GitHub CLI installieren.' >&2; exit 1; }
gh auth status
if ! git remote get-url origin >/dev/null 2>&1; then git remote add origin "https://github.com/${repo}.git"; fi
git push -u origin "$branch"
if gh pr view "$branch" -R "$repo" --json url --jq '.url' 2>/dev/null; then
  exit 0
fi
gh pr create -R "$repo" --base main --head "$branch" \
  --title 'Koncha 0.5 alpha: device signatures, multiple chats and opt-in presence' \
  --body 'Incremental test version: P-256 local device signatures and fingerprints, manually pinned trust, multiple independent 1:1 rooms, bounded encrypted offline mailbox, optional ephemeral presence and local AI capability test. Not audited E2EE; no forward secrecy, no mobile WebGPU model, no closed-PWA Web Push. Review docs/SECURITY_0_5.md and docs/PWA_DEVICE_TESTS.md; npm test.'
