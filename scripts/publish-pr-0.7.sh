#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
repo='petrk94/koncha-chat'
branch='feat/web-push-device-tests-and-local-ai-checks'
[[ "$(git branch --show-current)" == "$branch" ]] || { echo "Erwarteter Git-Branch: $branch" >&2; exit 1; }
[[ -z "$(git status --porcelain)" ]] || { echo 'Lokale Änderungen vorhanden. Bitte erst prüfen und committen.' >&2; exit 1; }
command -v gh >/dev/null || { echo 'GitHub CLI gh nicht installiert.' >&2; exit 1; }
gh auth status
if ! git remote get-url origin >/dev/null 2>&1; then git remote add origin "https://github.com/${repo}.git"; fi
npm test
php -l public/api.php
php -l public/push-service.php
git push -u origin "$branch"
if gh pr view "$branch" --repo "$repo" --json url --jq .url 2>/dev/null; then exit 0; fi
gh pr create --repo "$repo" --base main --head "$branch" \
  --title 'Koncha 0.7 alpha: opt-in Web Push and on-device translation integrity tests' \
  --body 'Incremental feature branch: opt-in per-chat VAPID Web Push with EMPTY payloads, push provider allowlist and metadata privacy notes; cache-safe SW generic notification, fallback from unsupported browser-native Translator pairs to self-hosted local WASM Worker, and SHA-256 model asset verification. GitHub CI + expanded automated tests. NOT production E2EE: no Forward Secrecy/Double Ratchet yet. Real local model inference and physical iOS/Android Push still untested. See docs/RELEASE_NOTES_0_7.md and docs/WEB_PUSH_0_7.md.'
