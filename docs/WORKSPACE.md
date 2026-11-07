# Koncha development workspace and current state

## Source of truth

- GitHub: `https://github.com/petrk94/koncha-chat`.
- Git's repository root is **not** the PHP `public/` directory; use `git rev-parse --show-toplevel`.
- Recommended permanent local folder: `~/Projekte/koncha-chat`. Avoid working from versioned ZIP extraction folders in `~/Downloads/`.
- `main` is only the latest **merged** version. Feature branches are work in progress until merged.
- PR #3 merged Koncha 0.5 into main. Koncha 0.6 is developed in branch `feat/local-ai-pwa-security-migration`; do not assume it is merged until verified on GitHub.
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

- v0.2.0-alpha.1 merged as PR #1 on 2026-11-07.
- v0.3 UI and v0.4 notifications merged together as PR #2 on 2026-11-07.
- v0.5.0-alpha.1 device identities, multiple rooms, presence and offline mailbox are in a new feature branch until PR merge.

Always confirm GitHub status before claiming any new merge or deployed release.

## 0.5 source additions

| Path | Purpose |
| --- | --- |
| `public/identity.js` | Non-extractable local P-256 private key, signature verification, device fingerprints |
| `public/rooms.js` | Local deduplicated room index |
| `public/translation-capabilities.js` | Browser-local native API / WebGPU / WASM availability probe; no model included |
| `docs/SECURITY_0_5.md` | Threat model, security claims and missing audited E2EE |
| `docs/PWA_DEVICE_TESTS.md` | Incremental iPhone / Android physical acceptance matrix |
| `scripts/publish-pr-0.5.sh` | GitHub-CLI branch publishing helper if GitHub connector denies writes |

Do not commit `var/rooms/*.json`, invitation URLs, exported private keys or chat content.


## 0.6 working files

- `public/sw.js`: offline app-shell cache; excludes `api.php` and model files.
- `public/pwa-diagnostics.js`: PWA feature report.
- `public/local-translation.js`: local worker transport.
- `src/local-translation.worker.js`: optional ONNX/WASM inference source.
- `scripts/build-local-ai.mjs`: optional on-device translation build (npm dependencies required).
- `scripts/prepare-models.py`: optional model provisioning on the developer machine.
- `public/models/`, `public/vendor/` and `public/local-translation.worker.js`: generated, ignored by Git. Deploy separately after review.
- `public/protocol-status.js`: explicitly marks missing forward secrecy/security audit, not an E2EE implementation.
- `docs/SECURITY_PROTOCOL_0_6.md`, `docs/LOCAL_AI_0_6.md`, `docs/PWA_TESTS_0_6.md`: specifications and manual acceptance test plans.


## 0.7 incremental files (after 0.6 merged into main)

- `public/push-service.php`: validates recipient push endpoints, builds RFC 8292 VAPID ES256 JWT, sends **empty** Web Push via HTTPS and PHP cURL.
- `public/push-client.js`: opt-in per-chat push subscription/unsubscription, device feature check and VAPID key validation.
- `public/api.php`: authenticated `push_config`, `push_subscribe`, `push_unsubscribe`; relay triggers generic push only when a new ciphertext envelope arrives.
- `public/sw.js`: closed-PWA generic push-notification handler, still no private data in app-shell cache.
- `scripts/generate-vapid.sh`: creates a server private key outside web root (never Git).
- `scripts/verify-local-ai.mjs`: validates ONNX asset manifest, SHA-256, runtime presence, paths. Does not test inference.
- `docs/WEB_PUSH_0_7.md`: server prerequisites and physical iOS/Android acceptance matrix.
- `.github/workflows/tests.yml`: automated tests on PRs and main.

**0.7 limitation:** no physical device or push-provider delivery test. Existing E2EE still lacks forward secrecy. Real local model inference still needs separately provisioned packages and model weights. Do not call this a final release.
