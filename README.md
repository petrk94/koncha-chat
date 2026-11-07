# Koncha — private intercultural messenger (experimental)

**Current feature branch:** `feat/device-identity-multiroom-presence`  
**Candidate version:** `0.5.0-alpha.1`  
**Status:** For testing with invented messages only. **Not audited secure E2EE.**

Koncha is a from-scratch browser/PWA messenger with a small PHP ciphertext relay. It is not a fork of SimpleX or Signal and does not implement SMP or Double Ratchet. The project is copyrighted by Kirpeit Solutions; see [LICENSE.md](LICENSE.md).

## Source of truth

- GitHub: https://github.com/petrk94/koncha-chat
- `main` is the most recently merged release (last verified **0.4**, GitHub PR #2).
- New 0.5 work must stay in a feature branch until the PR is reviewed and merged. Never copy files from old ZIP folders into a newer tree without diffing.
- On your own Linux system: use **one** working folder (`~/Downloads/koncha-chat` or optionally `~/Projekte/koncha-chat`) and check `git status -sb` and `./scripts/doctor.sh` first.

## What's implemented in 0.5 alpha

- A **locally generated P-256 ECDSA private key** in IndexedDB for each browser identity; a public device fingerprint can be compared out-of-band with a contact. A confirmed device key is pinned locally; signed messages with a changed key are rejected. This authenticates a particular key, not a human.
- Unique room secrets per **one-to-one conversation**, a locally stored conversation list, multiple independent contacts, 60-minute one-time invites with personal display name and handle, and server rejection of additional invites once a room has been claimed.
- Browser-local AES-256-GCM message encryption, digitally signed new messages, and local signed-nonce replay deduplication. Not a forward-secret or audited E2EE protocol.
- Relay retains ciphertext for up to **7 days**, max 300 messages per room, deleting on next activity after expiry. An absent user can fetch stored ciphertext upon returning; there is no guaranteed delivery or read receipt.
- Optional online activity indicator based on a **random room-specific pseudonym**. Presence is opt-in, expires after ~70 seconds, and can be spoofed by any holder of the room secret. It indicates activity, not a verified person online.
- DE/EN/JA UI, Japanese IME-safe Enter to send, emoji, kana-to-romaji, and optional native on-device browser Translator API when available. **No cloud inference.**
- A capability-check button for native translation API, WebGPU and WebAssembly. **WebGPU/WASM translation models are not yet bundled**, and API availability doesn't mean a requested language pair works.
- While the app is running: hidden-tab sound, favicon unread count and optional privacy-preserving system notices. **No closed-app Web Push yet.**

## Run on Linux

Requires PHP 8.2+, Node 20+ for tests, secure browser context and IndexedDB.

```bash
cd ~/Downloads/koncha-chat
./scripts/doctor.sh
npm test
php -S 127.0.0.1:8787 -t public
# Browser: http://127.0.0.1:8787/
```

For physical iPhone/Android devices use a reachable **HTTPS** server. Do not expose the PHP development server directly to the Internet. Point the public web root at `public/`; **`var/rooms/` must live outside the web root**. See [docs/PWA_DEVICE_TESTS.md](docs/PWA_DEVICE_TESTS.md).

## Security, privacy and retention

**Do not use this alpha for confidential messages.** The shared room key permits retrospective decryption after key compromise. There is no forward secrecy, ratchet, secure device recovery, malicious-client-update defense, hardened relay, trusted-directory identity verification, abuse/rate controls, or independent security audit. Device fingerprints must be compared through another trusted channel. Invite names/handles are self-declared. Screenshot protection is not available in browser PWAs.

- Local IndexedDB: device keypair, identity, room secrets, encrypted message cache, replay identifiers, preferences. Clearing site data permanently removes local access; there is no automatic recovery.
- PHP relay: room IDs, bearer-token verifier, encrypted envelopes, timestamps, temporary room-presence records. Webserver access logs may contain IP addresses; the relay is **not anonymous**.
- Translation: decrypted chat text is processed only on the recipient's device by the local browser API if the device supports it. No cloud fallback.

Read [docs/SECURITY_0_5.md](docs/SECURITY_0_5.md), [docs/LOCAL_TRANSLATION.md](docs/LOCAL_TRANSLATION.md) and [docs/RELEASE_NOTES_0_5.md](docs/RELEASE_NOTES_0_5.md).

## Publish the new branch via GitHub CLI

The connected GitHub app currently rejects write operations with HTTP 403. If that remains the case, use the included **Git history** and your authenticated local `gh` CLI:

```bash
./scripts/publish-pr-0.5.sh
```

It checks the branch and dirty files, adds `origin` only if missing, pushes `feat/device-identity-multiroom-presence` and opens a PR to `main`. **Do not merge untested claims of production security.**
