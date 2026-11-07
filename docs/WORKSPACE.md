# Koncha development workspace and current state

## Source of truth

- GitHub: `https://github.com/petrk94/koncha-chat`.
- Git's repository root is **not** the PHP `public/` directory; use `git rev-parse --show-toplevel`.
- Recommended permanent local folder: `~/Projekte/koncha-chat`. Avoid working from versioned ZIP extraction folders in `~/Downloads/`.
- `main` is only the latest **merged** version. Feature branches are work in progress until merged.
- PR #5 merged Koncha 0.7 into `main` on 7 November 2026; for future changes always verify the current repository head rather than trusting this dated note.
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
| `public/sw.js` | Offline app shell and opt-in generic Web Push notification handler | yes |
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
- Foreground/background-tab system notice: while a chat tab is running, browser notifications require explicit permission and never include sender name or message text. Closed-PWA Push is a separate opt-in feature described below.
- **Fully closed PWA**: optional Web Push support was added in 0.7 using an empty payload and VAPID, but requires HTTPS, permission, PHP cURL, server-side keys and a compatible push service. Delivery has NOT been verified on physical iOS/Android devices. On iOS, use a Home Screen app.
- Privacy: no chat text is included in system notifications, icon badges or server push endpoints. No notification API is called with a decrypted message.

## Version progression

- v0.2.0-alpha.1 merged as PR #1 on 2026-11-07.
- v0.3 UI and v0.4 notifications merged together as PR #2 on 2026-11-07.
- v0.5.0-alpha.1 device identities, multiple rooms, presence and offline mailbox merged as PR #3 on 2026-11-07.
- v0.6.0-alpha.1 offline shell and local model worker scaffolding merged as PR #4 on 2026-11-07.
- v0.7.0-alpha.1 optional Web Push and AI integrity tests merged as PR #5 on 2026-11-07.

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
