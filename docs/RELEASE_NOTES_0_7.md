# Koncha 0.7.0-alpha.1 — delivery & testability milestone

This alpha is **not an independently audited secure messenger**. It does not implement a reviewed Double Ratchet or Forward Secrecy and is not suitable for private conversations.

## Implemented and tested locally

- Per-chat **opt-in** closed-PWA Web Push subscription workflow, with no plaintext or encrypted message content in the payload. Server uses authenticated room association, an allowlist for known Push vendor domains and VAPID ES256 signing. Works only when a configured server has PHP cURL and the platform accepts Web Push. Real vendor delivery remains **untested**.
- New service worker push event displays a generic notification and opens the existing app, while retaining strict offline app-shell cache exclusions.
- Server retains subscriptions only as metadata with lazy 30-day expiry and manual per-room unsubscribe. A browser reset tries to revoke subscriptions before deleting the room keys and warns if that is not possible.
- An on-device model-integrity verification tool checks all generated model asset hashes and required runtime files (`npm run ai:verify`). This does **not** install or execute models or validate translation output.
- New automated regression tests: VAPID JWT cryptographic signature verification, endpoint SSRF protection, push client consent and metadata minimization, worker notification isolation, and model tampering/path traversal.
- GitHub Actions CI workflow runs PHP/JavaScript syntax checks and the Node/PHP test suite for new PRs.

## Open, blocking security/release requirements

- Integrate a **reviewed E2EE session protocol with forward secrecy**. Existing single-room-key encryption and device signatures do not provide it. No claim of production-grade security is permitted.
- Provision, license-review and run the ONNX model weights and runtime on real browsers; desktop/Android/iPhone translation correctness and performance are **not validated**. The script currently verifies hashes only.
- Test browser Push vendor delivery with a real HTTPS deployment and physical devices. A supported API and passing unit tests do not prove push works in background.
- Harden PHP relay against abuse/DoS, add deterministic retention cleanup, server monitoring without message metadata leaks, and independent security review.

Primary references: `docs/WEB_PUSH_0_7.md`, `docs/LOCAL_AI_0_6.md`, `docs/SECURITY_PROTOCOL_0_6.md`, `docs/PWA_TESTS_0_6.md`.
