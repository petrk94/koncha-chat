#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
repo='petrk94/koncha-chat'
branch='feat/local-ai-pwa-security-migration'
[[ "$(git branch --show-current)" == "$branch" ]] || { echo "Erwarteter Git-Branch: $branch" >&2; exit 1; }
[[ -z "$(git status --porcelain)" ]] || { echo 'Arbeitsverzeichnis nicht sauber.' >&2; exit 1; }
command -v gh >/dev/null || { echo 'GitHub CLI fehlt.' >&2; exit 1; }
gh auth status
if ! git remote get-url origin >/dev/null 2>&1; then git remote add origin "https://github.com/${repo}.git"; fi
git push -u origin "$branch"
if gh pr view "$branch" -R "$repo" --json url --jq '.url' 2>/dev/null; then
  exit 0
fi
gh pr create -R "$repo" --base main --head "$branch" \
  --title 'Koncha 0.6: offline PWA, on-device ONNX worker scaffold and E2EE migration plan' \
  --body 'Incremental alpha branch: static offline app-shell cache without message/API caching, PWA feature diagnostic, local-only Transformers.js/ONNX worker with developer-side asset provisioning, and explicit audited-E2EE migration requirements. Current shared-room-key E2EE is NOT forward-secret; models are NOT bundled or real-device-tested; closed-app push NOT implemented. See docs/RELEASE_NOTES_0_6.md. npm test.'
