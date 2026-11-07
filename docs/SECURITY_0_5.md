# Koncha 0.5 security model — EXPERIMENTAL

**This is NOT production-ready secure E2EE.** No independent security audit or forward-secret ratchet exists. Use fabricated test data only.

## What is genuinely encrypted

- The browser creates a fresh random 256-bit room secret for **each contact**. Message bodies are encrypted on the sending device with AES-256-GCM using a key derived through HKDF; the PHP relay stores envelopes, timestamps and room metadata, not the plaintext.
- The first recipient claims a short-lived invitation once, receiving that secret via a token-derived authenticated encrypted handoff. The server does not receive the bearer token as plaintext; its verifier is SHA-256, and the room-key handoff is ciphertext. Whoever claims first can enter the room. Invite labels are self-declared and not verified names.
- After the first claim, server disallows further invitations to that room. This is NOT a cryptographic limit on devices that already possess the secret; copied or compromised secrets still grant full access.
- Encrypted messages remain on the relay for up to **7 days** (maximum 300 messages per room), cleaned lazily on access. Delivery is best-effort, with no receipt confirming the recipient actually viewed the message. Backups/logs might outlive this limit.

## Device signature and verification

- Every browser generates a Web Crypto **ECDSA P-256** keypair. The private key is non-extractable within Web Crypto and stored as a CryptoKey in local IndexedDB. This does **not** protect against a compromised JavaScript origin, XSS, malicious extension, or compromised device.
- Outbound messages are signed over the room ID, pseudonymous sender ID, alias, handle, timestamp, unique nonce, room-specific presence token and plaintext. The signature and public key travel **inside** the encrypted envelope.
- Inviter's public device key is included in the encrypted invite handoff; the recipient pins it. For the invitee's key, the sender uses **trust on first valid signed message**. If the pinned key changes, verification fails and the message is discarded.
- Each device displays a **full 256-bit SHA-256 fingerprint** of its public key, formatted for comparison. The user can mark a contact as verified **only after comparing the whole code through a separate trusted channel**. This only verifies the particular device key, not a person's legal identity.
- Signed message nonces are atomically saved alongside envelopes in IndexedDB to reject replayed signed bodies with fresh outer message IDs. Removing browser data deletes the replay history; the server can still withhold/reorder messages. Legacy unsigned messages may be shown with an unverified tooltip for old rooms; new rooms require signatures.

## Why this is not yet safe to entrust with private messages

1. **No forward secrecy / post-compromise security.** Compromise of a room secret exposes archived ciphertext and future messages for that room. There is no Double Ratchet or one-time prekey design.
2. **No authenticated recovery, remote device revocation or cross-device linking.** Browser-storage loss is permanent. The local fingerprint can be changed by reset; aliases and handles are not unique.
3. **No protection against malicious code distribution.** The server can serve altered JS to capture plaintext or private-key use. Subresource integrity, signed release verification, independent review and strict update policy are missing.
4. **No strong relay abuse controls.** The PHP file-backed relay lacks robust quotas, rate-limits, resource controls, DoS protection, horizontal scaling and compliance checks. Never deploy publicly as a production messenger.
5. **Presence is opt-in and unauthenticated as an online claim.** The relay retains room-specific random pseudonyms and last-seen timestamps for ~70 seconds; a participant with the shared room secret can fabricate online activity. Presence should be treated as an approximate hint only. The server learns request timing and IP addresses from normal connections/logs.
6. **No guaranteed offline delivery.** Seven-day bounded ciphertext storage is not Web Push. A closed PWA cannot notify users until a separate opt-in Web Push/VAPID implementation is built. Push is likely to expose timing/endpoint metadata to push infrastructure.
7. **A malicious peer can always copy text / make screenshots.** No browser API reliably prevents screenshots. Recipient identity is not verified merely by accepting a link.
8. **Message metadata leakage**: the relay sees room identifiers, timing and sizes, but not plaintext. Browser scripts at the app origin can access local crypto operations and IndexedDB.

## Reviewed protocol decision required before beta

Choose an actively maintained, audited E2EE implementation supporting **browser Safari, Firefox and Chromium**, including device authentication and a tested asynchronous Double Ratchet. Vet the *exact* library distribution, API stability, browser/WASM viability and licensing against Kirpeit Solutions' proprietary commercial intent. Do not copy AGPL source into the repository without license authorization. `@signalapp/libsignal-client` currently documents native Node bindings and describes use outside official Signal apps as unsupported; it is **not** a drop-in Safari PWA library.

Do not claim Signal Protocol, forward secrecy, verified human identity or secure production E2EE until these are integrated, independently reviewed, and tested with device-loss, replay, rollback, traffic manipulation and key compromise scenarios.
