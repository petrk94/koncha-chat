# Koncha security warning

Version 0.5 introduces per-device P-256 signatures, full key fingerprints and local key pinning for **new rooms**, but has **no audited end-to-end security protocol**, forward secrecy or post-compromise security. Device verification identifies a key after comparison, **not a legal person**. The shared-room secret still carries confidentiality; anyone who obtains it can read stored ciphertext.

Read [SECURITY_0_5.md](SECURITY_0_5.md) for the complete current threat model and limitations.

**Use only fabricated test messages. Do not send passwords, payment, health, identity or intimate information.**


### 0.7 opt-in Web Push metadata warning

Koncha now offers experimental, explicit per-room Web Push subscriptions (not enabled by default). The server stores vendor subscription URLs linked with a room and a random per-room device ID for up to 30 days after last registration, removed lazily. **The same Push subscription endpoint across multiple rooms lets the server correlate contacts.** Empty push notifications contain no message/sender/room/ciphertext content, but vendor endpoints, delivery timing and network data reveal metadata. The PHP relay does not become anonymous, forward-secret or audited through this feature. Push subscriptions are revoked per room when possible, and local reset warns when offline unsubscription fails. Read `docs/WEB_PUSH_0_7.md`.
