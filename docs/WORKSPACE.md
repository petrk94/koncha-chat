# Koncha development workspace and current state

## Source of truth

- GitHub: `https://github.com/petrk94/koncha-chat`.
- Git's repository root is **not** the PHP `public/` directory; use `git rev-parse --show-toplevel`.
- Recommended permanent local folder: `~/Projekte/koncha-chat`. Avoid working from versioned ZIP extraction folders in `~/Downloads/`.
- `main` is only the latest **merged** version. Feature branches are work in progress until merged.
- Branch `feat/notifications-and-workspace` builds **on top of** the unmerged `feat/chat-clarity-personal-invitations` changes (Koncha 0.3). A PR from it to `main` intentionally includes both UI/invite and notification improvements.
- The original `~/Downloads/koncha-chat-github-ready/koncha-chat` is the older scaffold (before v0.2) unless you explicitly run `git fetch` and switch branches. It must not be mistaken for the latest source.

## Important commands

```bash
cd ~/Projekte/koncha-chat
./scripts/doctor.sh      # Current working directory, branch, dirty files, latest commit, remote

git status -sb           # Local status; `gh status` does NOT exist
git branch -avv          # Local and remote branches
git fetch origin         # Update remote refs, does not change files
git log --oneline -5     # Recent commits
gh pr status -R petrk94/koncha-chat  # PR overview
npm test                 # No npm install needed
php -S 127.0.0.1:8787 -t public
```

If you have modified tracked files, inspect `git status` first and commit/stash before switching branches. Never `git reset --hard` without checking your work.

## Directory map

| Path | Purpose | Tracked in Git? |
| --- | --- | --- |
| `AGENTS.md` | Codex/agent constraints and release rules | yes |
| `README.md` | Project overview and run instructions | yes |
| `docs/` | Architecture, security, roadmap, testing and workspaces | yes |
| `public/index.html` | App structure, onboarding, invitations and chat settings | yes |
| `public/styles.css` | Desktop and responsive PWA visuals | yes |
| `public/app.js` | Application state, chat and polling | yes |
| `public/i18n.js` | German, English and Japanese UI copy | yes |
| `public/notifications.js` | Hidden-tab sound, unread favicon and application badges | yes |
| `public/sw.js` | Service worker for click-to-open system notifications; **not** Web Push | yes |
| `public/crypto.js` | Experimental encryption and invitation helper functions | yes |
| `public/db.js` | Client-side IndexedDB settings and encrypted cache | yes |
| `public/api.php` | PHP ciphertext relay and invitation state | yes |
| `public/translation.js` | Experimental local/browser translation adapter | yes |
| `public/manifest.webmanifest` | PWA install metadata | yes |
| `public/icon*` | Browser and PWA icons | yes |
| `tests/` | Node/PHP and optional browser tests | yes |
| `scripts/` | Local diagnostics and development helpers | yes |
| `var/rooms/*.json` | **Runtime test data** from the PHP relay, never commit or share | no (`.gitignore`) |

## Alert behavior / limits

- Hidden **open tab**: polls every ~2.8s (subject to browser background throttling); encrypted incoming messages are decrypted locally. Newly received peer messages raise the unread count in the page title and favicon, optional short audio and app icon badge, plus a generic OS notification **only when permission has been explicitly granted**.
- Visible chat: clear unread count and app badge.
- Audio: Web Audio must first be unlocked by a user gesture. Browsers may suspend background audio.
- Web system notification: service worker is registered after explicit permission. On mobile, a running tab/PWA is needed. OS notification contains neither sender name nor message text.
- **Fully closed browser/PWA**: no delivery or notifications; no Push API subscription, server-side VAPID push or background delivery yet. iOS requires a Home Screen app for Web Push.
- Privacy: no chat text is included in system notifications, icon badges or server push endpoints. No notification API is called with a decrypted message.

## Version progression

- v0.2.0-alpha.1 merged as PR #1 into main on 2026-11-07.
- v0.3.0-alpha.1 chat-first UI/personal invitation branch was prepared but had not merged when this package was built.
- v0.4.0-alpha.1 notification changes live on top of that v0.3 branch in this deliverable.

Always confirm GitHub status before claiming any new merge or deployed release.
