# Koncha roadmap

## 0.1 — local proof of concept [implemented / tests passed]

- Two profiles/devices exchange ciphertext through a PHP relay.
- Local onboarding and keys stored in IndexedDB; room joined by secret URL fragment.
- No contact book or mandatory phone/email.
- Kana-only reading aid, not cloud translation.
- Source contains security limitations and third-party inventory.

## 0.2 — invitation, UX and browser-native language foundation [implemented / automated tests passed; device tests pending]

- 60-minute, single-use server-validated invitations with encrypted room-key handoff, rotation and revoke.
- DE/EN/JA UI locale selection (browser default / saved choice); mobile chat layout, emoji, Enter-to-send with Japanese IME safeguards.
- Per-room display/translation controls. Browser-native on-device translation adapter where available; WebGPU/WASM worker fallback not yet packaged.
- Explicit documentation that screenshot protection, central accounts, recovery, verifiable identity and production security are absent.

## 0.3 — serious security design [not yet implemented]

- Written threat model (honest participants, dishonest peers, malicious relay, compromised client, spammer).
- Authenticated device identities and out-of-band key/fingerprint verification.
- Replace shared-room key with reviewed E2EE session protocol and forward secrecy.
- Independent consultation/review for use of library/protocol and license compatibility.
- Tests for replay, corrupted messages, race/reordering, persistence and key rotation.

## 0.4 — privacy controls [not yet implemented]

- Revocable invitations are prototyped; add per-contact permission/reachability, explicit blocking/abuse handling.
- No implied social graph; independent pseudonyms for each relationship.
- Deterministic server retention, request limits, recovery and backup policy.

## 0.5 — inter-cultural layer [partially prototyped]

- DE/EN/JA UI localization is prototyped; improve accessibility and Japanese copy review.
- Kana-to-romaji is prototyped. Add kanji reading/furigana and license-reviewed, self-hosted WebGPU/WASM browser model fallback (especially iPhone Safari).
- No cloud translation fallback. A future cloud mode would require an entirely separate explicit privacy/product decision.
- Politeness and cultural context notes clearly labeled as suggestions, not facts.

## 0.6 — test beta [not yet implemented]

- Device testing on Android and iOS using HTTPS and PWA installation.
- OS storage eviction, background behavior and notification design.
- Security review, release/versioning, privacy law and license review.
