#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
repo='petrk94/koncha-chat'
branch='feat/notifications-and-workspace'
[[ "$(git branch --show-current)" == "$branch" ]] || { echo "Erwarteter Branch: $branch" >&2; exit 1; }
[[ -z "$(git status --porcelain)" ]] || { echo 'Bitte zuerst lokale Änderungen committen oder staschen.' >&2; exit 1; }
command -v gh >/dev/null || { echo 'GitHub CLI fehlt: sudo apt install gh' >&2; exit 1; }
gh auth status
if ! git remote get-url origin >/dev/null 2>&1; then git remote add origin "https://github.com/${repo}.git"; fi
printf '\nRepo: %s\nBranch: %s\n' "$repo" "$branch"
git push -u origin "$branch"
if gh pr view "$branch" -R "$repo" --json url --jq '.url' >/dev/null 2>&1; then
  gh pr view "$branch" -R "$repo" --json url --jq '.url'
else
  gh pr create -R "$repo" --base main --head "$branch" \
    --title 'Koncha 0.4: Focused chat, personal invites and notifications' \
    --body 'Combines previously prepared Koncha 0.3 chat-first/personal invitation changes with 0.4 hidden-tab unread badge, opt-in sound, optional local OS notifications and workspace documentation. No closed-app Web Push yet. Experimental unverified E2EE. Run npm test and review security docs before merge.'
fi
