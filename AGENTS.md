# Koncha coding-agent project instructions

Target: clean-room independent implementation of a privacy-first DE/EN/JA private messenger. Our initial build is a **demo, not a secure chat app**.

## Non-negotiables

- Do **not** copy SimpleX (AGPL) source or branding, proprietary assets or snippets. Studying publicly documented architecture is permitted; cite specifications in docs.
- Do **not** imply production-grade encryption, anonymity, forward secrecy, identity verification or message deletion until independently demonstrated/audited.
- Do **not** commit keys, real user messages, login tokens, EML samples, PII, credentials, analytics identifiers or any server state. Keep storage outside the webroot.
- Do **not** add remote translation or AI providers, tracking pixels, ads, phone-book syncing or telephone/email requirements without explicitly approved privacy design.
- Do **not** invent cryptographic algorithms. For production features, select peer-reviewed protocols and approved compatible libraries after license/security review.
- Privacy-by-default: no public profiles, no social graph, no friend suggestions, no open contact lookup.
- Prefer simple PHP 8.2+ and browser-standard JS for current stage; protect source of private server state.
- New third-party components require inventory and license review in docs/DEPENDENCIES.md.
- Every feature must have tests and clear limits in docs/SECURITY.md and docs/ARCHITECTURE.md.
- Treat invite links as secrets, not user identities. Keys must not be included in HTTP paths, query strings, logs, analytics or third-party requests.

## Validate before changes are proposed

```bash
php -l public/api.php
npm test
```

The optional `python tests/browser-smoke.py` runs a two-profile Chromium UI simulation, if a local Chromium browser is permitted to reach loopback HTTP by the environment.

## Development order

1. Verify functionality and retention in two distinct devices over HTTPS.
2. Draft threat model and choose a reviewed E2EE protocol/library; do not deploy real private conversations using prototype encryption.
3. Add explicit identity verification and resilient local encrypted key store.
4. Introduce safe contact control/revocation, abuse protections, and deterministic server retention.
5. Add high-quality JA/EN/DE local translations and contextual kana+kanji readings.
6. Security review before internet-facing beta.

## 0.2 local AI and invitation additions

- The `Translator` API is an on-device **browser capability**; do not replace it with remote LLM requests when missing. See `docs/LOCAL_TRANSLATION.md` for planned WebGPU/WASM fallback.
- Translations do not alter original message data or get relayed; use explicit opt-in.
- Do not use non-commercial model licenses in a potentially commercial Koncha release.
- Invite URLs must not include persistent room secrets. Only the first valid redemption succeeds, within 60 minutes. All expiry/rotation/revoke paths need server tests.
- Japanese IME text composition must never send messages by pressing Enter to select kanji/kana candidates.

## Chat UI and invitation identity (0.3)

- Keep the conversation screen chat-first. Do not permanently render translation, invitation, account or security management above the message log; use the existing accessible settings overlay.
- Incoming invite URLs must first show a dedicated inviter preview, not a create-room form. Recipient local identity setup comes after explicitly accepting the invitation.
- An invitation's name and handle are **self-declared, not authenticated**. Never add a verified checkmark or impersonation-resistant claim until a reviewed device-key identity protocol exists.
- Avoid leaking invite secrets, room keys or plaintext messages to analytics, server logs, remote translation APIs or third-party assets.
- Preserve localized DE/EN/JA UI, Enter-to-send with Japanese IME guard, compact mobile keyboard-safe composer and the 60-minute one-time invite behavior.

## Notifications (0.4)

- Decrypted chat text and peer identities must never appear in OS notifications, push payloads, favicon/title, logs or badge metadata.
- The currently implemented notifications only work while a browser tab/PWA remains running. Never claim closed-app background Web Push works; it needs an authenticated subscription and separate server design.
- Do not prompt for OS notification permission automatically on page load. Ask within a direct user gesture only. Audio is best effort and subject to browser activation/throttling.
- In 0.6, `public/sw.js` caches ONLY the static app shell for offline opening. NEVER cache `/api.php`, model weights, keys, chat plaintext or relay responses. Network-first static assets are required to avoid obsolete cryptography code.
- Keep the permanent workspace documented in `docs/WORKSPACE.md` and the diagnostics in `scripts/doctor.sh`.

## v0.5 boundaries for agents/Codex

- A manually pinned ECDSA P-256 fingerprint authenticates only the compared device key, never the real-world user. Avoid security "verified" claims without out-of-band comparison.
- Do not implement a proprietary Double Ratchet or claim forward secrecy without a vetted browser-compatible audited library and peer review.
- All new rooms require signed messages; legacy unsigned messages must be clearly marked or rejected. Preserve per-room unique keys.
- Do not upload contact aliases, private keys, room secrets, invitation links or raw chat texts to GitHub, logs, telemetry or translation APIs.
- Presence is opt-in, pseudonymous per room and must expire rapidly; do not claim it is a trustworthy human online status.
- The relay is an expiring ciphertext mailbox, not a reliable message broker; seven-day TTL is not a delivery guarantee.
- Do not claim iOS/Android PWA push or WebGPU model translation is implemented before real physical tests and deployment integration.

## 0.6 partial security/AI/PWA boundaries

- `src/local-translation.worker.js` executes on-device only. Run `npm run ai:build` and provision model weights before claiming inference; no models are distributed in Git. No outgoing plaintext HTTP calls or remote model loading.
- `docs/SECURITY_PROTOCOL_0_6.md` is a **migration specification, not the implementation of audited Double Ratchet E2EE**. Never label 0.6 production secure.
- The service worker caches only network-first app shell assets. Keep the server API uncacheable and never cache private data.
- Physical iOS/Android testing and closed-PWA push remain unperformed, regardless of capability flags.


## 0.7 Web Push + model integrity constraints

- Web Push is explicit opt-in PER conversation. Only empty messages go to vendor endpoints; NEVER plaintext, sender names, room IDs, chat ciphertext or invitation keys. The vendor does see timing and endpoint metadata, and the server can correlate rooms by an endpoint; disclose this.
- Use HTTPS-only vendor allowlist and no redirects. Keep VAPID private keys outside `public/`, in an environment path. Never accept arbitrary client URL targets or commit PEM keys.
- When deleting local data, attempt server push deregistration first and warn on failure.
- `npm run ai:verify` verifies local ONNX file integrity, not model quality or inference correctness. Never claim built-in iOS/Android translation until real model and physical device tests pass.
- Existing E2EE is experimental without forward secrecy; a Web Push change does not alter its security guarantees.
