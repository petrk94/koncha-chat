# Koncha 0.8 Alpha — 1:1 Olm Double Ratchet integration

**Status: Security-sensitive experimental feature. NOT independently audited, NOT cleared for real secrets.**
This document describes code integration, not a claim of secure production deployment.

## Cryptographic change in NEW rooms
- New chats are provisioned with independent vodozemac `0.11.1` Olm (3DH + Double Ratchet) accounts compiled to self-hosted WASM. No handwritten cryptographic ratchet; the thin Rust-to-JS bridge is in `crypto-wasm/`.
- The existing 256-bit per-room invite secret is only for one-time invite encapsulation, server authorization and the first handshake proof. It **never** encrypts v2 chat messages. The PHP relay stores opaque v2 `OlmMessage` ciphertext `{type,body}`, sender Curve25519 public key and a random outer message id.
- One-time invite (60 minutes) includes the inviter's Olm Curve25519, Ed25519 and one-time prekey authenticated inside the encrypted invitation. The invitee generates an independent Olm account, sends an encrypted authenticated pre-key `hello`, and the inviter responds with an encrypted `hello_ack`.
- Session peers are pinned to the inviter's invite identity and the joiner's confirmed first handshake. Both users must **compare their full Olm safety fingerprints over another trusted channel** before trusting the human identity.
- Olm session state and cached display history are encrypted separately on the local device under a non-extractable IndexedDB CryptoKey. The server cannot decrypt message content but learns room IDs, arrival times, approximate message counts, polling activity, IP addresses through server logs and push endpoints when enabled.
- Web Locks serialize ratchet activity between tabs; a single atomic IndexedDB transaction advances the ratchet, stores an encrypted display copy and queues the EXACT outgoing ciphertext for offline retry. If Web Locks, IndexedDB, WASM or secure context are unavailable, **new secure rooms do not fall back to v1**.
- Older v1 chats remain **clearly labeled legacy/no forward secrecy**. They are not silently upgraded. Do not reuse v1 room state or old message keys as ratchet state. Old recordings cannot become forward-secret retroactively.

## How to build and test
The WASM binary is NOT checked into GitHub source; build it from pinned Rust code and dependencies:

```sh
rustup target add wasm32-unknown-unknown
npm install
npm run crypto:build
npm test

python -m pip install playwright==1.56.0
python -m playwright install chromium
python tests/olm-wasm-browser.py
python tests/secure-chat-browser.py
```

Start PHP from project root with `npm run serve`, then use two independent browser profiles. In staging, serve over HTTPS; the browser's local `127.0.0.1` exemption is ONLY for local development. `public/vendor/olm/` is required in the *deployed web root* but must be created from trusted pinned sources.

## Threats / limitations
- **Front-end compromise:** browser-delivered malicious JS, extension malware, same-origin XSS and compromised device can read plaintext and use the non-extractable local wrapping key; Forward Secrecy does not protect against live endpoint compromise.
- **Identity substitution:** an attacker controlling the invite delivery channel can impersonate someone unless safety fingerprints are compared out of band. Olm device identity alone does not verify a human.
- **Unreviewed glue:** the Rust binding, invitation proof, IndexedDB/outbox store, JS state handling, PHP relay changes and deployment are custom code and have NOT been independently audited. A cryptographic library audit does not cover this app.
- **No guaranteed delivery:** PHP retains encrypted envelopes up to seven days subject to mailbox size and subsequent room activity. Lost device browser data equals lost session state; there is NO account recovery, cross-device sync or cryptographic state backup.
- **Browser support:** Web Locks, IndexedDB, Web Crypto and a secure context required. Build and test actual iPhone/Safari/Android/Firefox before claiming device availability.
- **Legacy mode:** existing v1 sessions lack FS; users must start NEW chats for Olm. Future UI should support exporting legacy plaintext only with opt-in and then creating a new secure room. No automatic mutation of old keys.
- **Offline and key rotation:** pending messages are persisted with their ratchet snapshot before transmission. A malicious server may delete/delay/reorder envelopes; check for replay, state rollback and stale/missing messages. We do not claim perfect protection against backup rollback.
- **Build provenance:** pin complete Cargo.lock and npm lockfile, capture hashes of WASM artifacts, scan dependencies, independently review crypto code and reproduce CI on physical devices before dropping test-only notices.
- **Security check:** `public/protocol-status.js` must never falsely declare global production security just because vodozemac is linked.

## Completion checklist for GitHub Issue #7
- [x] Real vodozemac Olm WASM bridge and actual Double Ratchet packet format (not mock crypto).
- [x] New-room encrypted invite / first-message handshake / encrypted PHP transport implemented in source.
- [x] Device key pinning and out-of-band safety fingerprint UI.
- [x] Local encrypted ratchet state + encrypted display history + queued ciphertext retry.
- [x] Legacy downgrade rejected in new rooms and old rooms explicitly marked as legacy.
- [ ] Successful two-browser full-path CI integration: invitation, chat, reload, offline, tamper and no plaintext on relay.
- [ ] Independent review of state machine, identity binding, concurrency, recovery and deployment.
- [ ] Verified physical Safari/Android compatibility; audited release build and key management.
