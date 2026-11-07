# Koncha 0.5.0-alpha.1 — incremental release notes

Source branch: `feat/device-identity-multiroom-presence` (PR pending). NOT production-secure.

| Capability | Status |
| --- | --- |
| Signed per-device identity P-256 and full fingerprint | Implemented, automated crypto tests |
| Device key pinning and out-of-band manual verification control | Implemented, browser manual acceptance pending |
| Atomic signed-message replay protection | Implemented, browser real-device acceptance pending |
| Multiple durable independent 1:1 rooms | Implemented, UI device test pending |
| Offline ciphertext mailbox (max 7 days / 300 envelopes) | Implemented, PHP integration tests |
| Approximate per-room presence (opt-in, 70s TTL) | Implemented, PHP tests; not identity proof |
| Native browser-local Translator API | Existing adapter retained; support depends on browser/pair |
| WebGPU/WASM feature probe | Implemented; local inference model NOT packaged |
| iOS/Android PWA tests | Checklist added; physical testing NOT performed |
| Web Push when completely closed | Not implemented; follow-up with VAPID/service-worker push |
| Audited E2EE ratchet and secure device recovery | Not implemented; independent security review needed |

The client's existing local-only cryptography is an experimental prototype. Signed messages and pinned keys are steps towards authentication, not a full substitute for a proven encrypted-messaging protocol.
