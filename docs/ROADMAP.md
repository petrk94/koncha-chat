# Koncha roadmap

## 0.1 — local proof of concept [implemented / tests passed]

- Two profiles/devices exchange ciphertext through a PHP relay.
- Local onboarding and keys stored in IndexedDB; room joined by secret URL fragment.
- No contact book or mandatory phone/email.
- Kana-only reading aid, not cloud translation.
- Source contains security limitations and third-party inventory.

## 0.2 — serious security design [not yet implemented]

- Written threat model (honest participants, dishonest peers, malicious relay, compromised client, spammer).
- Authenticated device identities and out-of-band key/fingerprint verification.
- Replace shared-room key with reviewed E2EE session protocol and forward secrecy.
- Independent consultation/review for use of library/protocol and license compatibility.
- Tests for replay, corrupted messages, race/reordering, persistence and key rotation.

## 0.3 — privacy controls [not yet implemented]

- Revocable invitations, per-contact permission/reachability, explicit blocking/abuse handling.
- No implied social graph; independent pseudonyms for each relationship.
- Deterministic server retention, request limits, recovery and backup policy.

## 0.4 — inter-cultural layer [not yet implemented]

- DE/EN/JA UI localization and accessibility.
- Kanji reading/furigana, kana-to-romaji, local-only translation when technically feasible.
- Consent-gated cloud translation only as an optional and carefully disclosed mode.
- Politeness and cultural context notes clearly labeled as suggestions, not facts.

## 0.5 — test beta [not yet implemented]

- Device testing on Android and iOS using HTTPS and PWA installation.
- OS storage eviction, background behavior and notification design.
- Security review, release/versioning, privacy law and license review.
