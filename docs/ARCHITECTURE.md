# Koncha architecture — prototype 0.2

## Motivation

A Japanese/international private chat application with opt-in relationships, local-first storage, and optional language aids. The experiment intentionally avoids accounts, phone numbers, email addresses, contact-book syncing, analytics, trackers and advertising SDKs.

## SimpleX concepts studied (not implemented/copied)

Public documentation:
- https://github.com/simplex-chat/simplexmq/blob/stable/protocol/simplex-messaging.md
- https://github.com/simplex-chat/simplexmq/blob/stable/protocol/overview-tjr.md

Concepts: invitation shared out-of-band; minimal routing metadata; per-relationship channels; relay should not need message plaintext. **Koncha is not SimpleX-compatible.** The prototype does not implement SMP, Double Ratchet, independent directional queues, forward secrecy or two-hop routing. Do not advertise SimpleX security properties for Koncha.

## Prototype components

```
Android/iPhone/desktop browser
    |  origin-bound JS + Web Crypto + IndexedDB
    |  HTTPS API (ciphertext only)
PHP 8.2 relay on own origin
    |  files in var/rooms OUTSIDE web root
    |  temporary encrypted envelopes, expiry on activity
```

Browser creates a high-entropy random room ID and 256-bit shared secret. For each invitation, the browser creates an independent 256-bit invitation token. The URL `#invite=<roomId>.<inviteId>.<token>` contains **no room key**. The room key is encrypted with a per-invitation key and stored as a temporary handoff on the relay. The relay stores only a SHA-256 verifier of the invite token, the encrypted handoff and a 60-minute expiration. The invited browser first checks availability, then atomically redeems the invitation once; the encrypted handoff is removed on claim, and the previous unused link is invalidated when a new one is created. Expired handoffs are erased on their next access, not precisely at the expiry instant. The **URL fragment must still be treated as a secret**; whoever redeems it first obtains the shared room key and can impersonate either participant. Once redeemed, link expiry does not remove room access.

The browser derives separate message-encryption and relay-authentication keys with Web Crypto HKDF-SHA-256 and different `info` domain labels. Messages use AES-256-GCM with a fresh 96-bit random IV and authenticated JSON payloads. The relay stores room ID, SHA-256 of relay bearer token, message UUID, IV, ciphertext and timestamps, not the plaintext or original room secret.

An attacker with the original invite can impersonate either party. A malicious server can replace the JavaScript bundle, observe IP addresses, withhold or replay ciphertext or correlate room activity; this prototype does not defend against those threats. **This is experimental envelope encryption, not an audited secure messenger or production-grade E2EE.**

## Storage and deletion

- Client IndexedDB: display name, consent state, random browser-local sender ID, room IDs and room secrets, cached ciphertext envelopes, language preferences.
- Server: hashed bearer token and ciphertext envelopes, max 300 most recent messages/room and 24-hour envelope expiry (garbage-collection on access, not a guaranteed timed deletion). Old room metadata may persist until an operator cleanup.
- Clearing browser data, resetting the app, or uninstalling the PWA can delete local keys permanently. No recovery is offered.
- Browser storage can also be evicted by the device and is **not a guaranteed permanent archive**.
- Third-party logging (web server, reverse proxies, CDN, hosts) may record IP addresses despite Koncha's own code not logging them. Configure logs separately.
- Incoming messages can be optionally translated with the native on-device Translator API, where available; otherwise translation is disabled until a browser-side WebGPU/WASM model is packaged. No chat text goes to a cloud translator. See LOCAL_TRANSLATION.md.

## Next-stage security prerequisites

1. Defined threat model and protocol review; authenticated identity / key verification; replay controls and Double Ratchet or an independently audited E2EE library; no custom crypto protocol for production.
2. Strong device-local key storage, secure backups, robust multi-device identity verification and recovery plan.
3. PWA code integrity/delivery trust, signed releases, independent security audit and penetration testing.
4. Abuse prevention without silent server-side access to private messages, invitation revocation, rate limits, complaint handling and optional reporting.
5. Queue routing to reduce metadata, protocol-compatible push notification model, robust retention and deletion, and load testing.
6. Privacy policy, relevant data-protection law review, accessibility, internationalization and business/legal release readiness.
