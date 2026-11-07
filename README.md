# Koncha · private intercultural messenger (experimental)

**Current development version:** `0.7.0-alpha.1` · **NOT production-ready, not audited secure E2EE.**

Koncha is a clean-room PHP 8.2+ and browser-JavaScript messenger prototype with a local-first DE/EN/JA UI. It is **not a fork** of SimpleX, Signal or Matrix. Original source is copyright Kirpeit Solutions, all rights reserved. See `LICENSE.md`.

## Working implementation

- Multiple one-to-one rooms and persistent contacts in the browser's IndexedDB.
- 60-minute, single-use invitation URLs with a self-declared inviting name/handle; recipient accepts before onboarding. Display names are **not** proof of human identity.
- AES-GCM ciphertext relay, P-256 device signatures/fingerprints and replay deduplication, but **one shared key per room**. This is experimental cryptography without forward secrecy or independently reviewed full protocol.
- Encrypted messages remain on the PHP server up to seven days (cleanup on room activity), with at most 300 stored messages per room. No guaranteed delivery or read receipts.
- Optional pseudonymous online signal while the app is running; not a verified presence signal.
- Responsive DE/EN/JA UI, Japanese IME-friendly Enter key, emoji, kana-to-romaji reading aid.
- Browser-native local Translator API where supported and optional client-side Transformers.js/ONNX WASM worker from the same Koncha origin. **Model weights and runtime are not bundled into Git**; until provisioned the UI correctly declines to translate. No cloud inference is allowed.
- Hidden-tab audio, unread favicon and generic OS notifications while the app runs.
- Offline PWA application shell, excluding chat API, secrets and model downloads from the service-worker cache. Previously cached encrypted messages may be viewed locally while offline; **offline sending is not available**.
- **0.7:** opt-in Web Push per chat with server-side VAPID signing and **EMPTY push payloads**. This requires a configured HTTPS server with PHP cURL and valid VAPID keys and an actual device subscription. Not tested end-to-end on iOS/Android yet. The push provider sees network metadata and a subscription endpoint, **not** message plaintext. The Koncha server can correlate subscriptions across rooms if the same device opts in to multiple chats.
- **0.7:** SHA-256 verification for provisioned local AI model weights, server-side Push endpoint allowlist and automated tests.

**Do not send confidential, intimate, financial, medical or identifying information in Koncha Alpha.** Read `docs/SECURITY_PROTOCOL_0_6.md` and `docs/SECURITY_0_5.md`.

## Run locally (Linux)

```bash
cd ~/Downloads/koncha-chat
./scripts/doctor.sh
npm test
php -S 127.0.0.1:8787 -t public
# open http://127.0.0.1:8787
```

Node >=20 and PHP >=8.2 are used for tests. The PHP built-in server is for **local development only**. Do not expose it publicly. To use real mobile devices, deploy over HTTPS with `public/` as the **only** served document root and keep `var/rooms/` outside it. In production-like demos also configure TLS, privacy-sensitive access logs, appropriate permissions, retention cleanup, and abuse/rate limiting.

## Optional client-only translation

```bash
npm install
npm run ai:build
python3 -m pip install huggingface_hub
python3 scripts/prepare-models.py ja-en en-ja de-en en-de
npm run ai:verify
```

Provisioned `public/models/`, `public/vendor/` and `public/local-translation.worker.js` are intentionally ignored by Git. They must be separately reviewed, tested and deployed to the **same origin** as the PWA. A passed checksum check is NOT proof of acceptable translation quality or successful inference. Confirm exact model licenses and attribution. Details: `docs/LOCAL_AI_0_6.md` and `docs/RELEASE_NOTES_0_7.md`.

## Optional closed-PWA Web Push

The push feature is **OFF by default** and fails closed without a server-side key and PHP cURL. Configure a P-256 VAPID signing key **outside** `public/`:

```bash
bash scripts/generate-vapid.sh
# Configure your PHP server environment:
# KONCHA_VAPID_PRIVATE_KEY_FILE=/absolute/path/outside/public/vapid-private.pem
# KONCHA_VAPID_SUBJECT=mailto:your-real-admin-contact@example.org
```

When HTTPS and Push are available, each participant can enable notifications **for each chat** inside Chat Settings. Messages continue to send even when push transport is unavailable. Read `docs/WEB_PUSH_0_7.md` before enabling: push endpoints can correlate relationships, delivery is not guaranteed, and iPhone requires an installed Home Screen PWA.

## Verification and project files

- `npm test` — Node/PHP automated tests; no npm install needed.
- `./scripts/doctor.sh` — checkout path, Git branch/status, release, remotes, runtime files.
- `npm run ai:verify` — checks provisioned model assets against pinned manifest SHA-256 digests.
- `docs/WORKSPACE.md` — map of each source directory and script.
- `docs/PWA_TESTS_0_6.md`, `docs/WEB_PUSH_0_7.md` — physical device acceptance plan.
- `docs/SECURITY_PROTOCOL_0_6.md` — **specification only**, not the implementation of Double Ratchet.

GitHub: https://github.com/petrk94/koncha-chat · Keep one local working directory; publish changes through a feature branch and PR. Do not commit real chats, private keys, generated model weights, room files, invite URLs or secrets.
