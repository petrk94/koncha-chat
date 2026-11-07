# Koncha 0.6 — E2EE protocol migration decision (NOT integrated yet)

## Current state: do not use for real private messages

Koncha v0.6 continues to use the v0.5 **single shared room key** AES-256-GCM experiment (Web Crypto, signed P-256 device payloads). This encrypts message bodies against a passive relay without the secret, but **does not offer forward secrecy**, cryptographically authenticated sessions with device revocation, or an independently audited full messenger implementation. This release does **not** solve item 1. `public/protocol-status.js` intentionally rejects any attempt to represent the current protocol as forward-secret or independently audited. This is a *guardrail*, not a new cryptographic protocol.

## Candidate for an implementation milestone: Matrix vodozemac / Olm

- `matrix-org/vodozemac` implements Olm Double Ratchet, Megolm and device-verification primitives in Rust; Matrix publishes a security audit. See https://github.com/matrix-org/vodozemac.
- Official browser WASM binding `@matrix-org/matrix-sdk-crypto-wasm` (Apache-2.0) offers Matrix E2EE device state and key handling. See https://matrix-org.github.io/matrix-sdk-crypto-wasm/.
- **Caution:** `OlmMachine` is a Matrix client-server E2EE state machine, not a drop-in replacement for `encryptPayload()` in Koncha. It expects Matrix identifiers, key upload/query, Olm sessions, Megolm and to-device event transport. Integrating this properly may mean switching the relay to a Matrix-compatible protocol or writing a vetted adapter with a high interoperability-test burden.
- Other pure-browser Signal implementations have varied licenses, independent-audit claims, and maintenance histories. In particular a GPL/AGPL package cannot be imported into this proprietary repository without an explicit licensing decision. Do not rely on vendor marketing summaries or changing npm license metadata alone.

## Security upgrade acceptance gates (must all pass before claiming actual E2EE)

1. Independent license and security review of a **specific pinned version**, source revision and compiled WASM distribution.
2. Establish two independent device identities and forward-secret sessions using reviewed library APIs, not the old shared room secret. Document authentication and key distribution/trust model.
3. Authenticate the protocol identity binding: security codes match the ratchet identity keys; reject silent key replacement, stale sessions and downgrade.
4. Enforce message counters, replay protection, out-of-order / dropped messages, bounded skipped keys, and serialized durable ratchet state updates; test Safari/Chromium/Firefox.
5. Design multiple devices, offline prekeys, lost device/recovery and remote revocation, plus relay-side anti-abuse quotas and finite retention.
6. Threat tests: malicious relay modifies, suppresses/replays, delays, races, or reorders messages; stolen old session state; XSS or modified served JS; nonce/session rollback; browser eviction/restore.
7. Independent cryptographic protocol review; security review of browser delivery (HTTPS, CSP, release integrity), not just algorithm selection.
8. Backward compatibility: old v0.5 rooms remain clearly labeled **experimental**. A secure chat must create a new protocol-bound session; do NOT silently import the old room secret and call it forward secret.

## Existing threats not fixed by a new cryptographic library

A malicious web server serving client JavaScript can access plaintext before encryption and after decryption. Metadata (IP, room references, timing, sizes), phishing of invites, screenshots by recipients, OS/browser compromise and coercion are outside message cryptography. Web Push must never transmit plaintext. Authenticating a device key does not validate the human identity behind a self-chosen display name.
