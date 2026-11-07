# Koncha security warning

Version 0.5 introduces per-device P-256 signatures, full key fingerprints and local key pinning for **new rooms**, but has **no audited end-to-end security protocol**, forward secrecy or post-compromise security. Device verification identifies a key after comparison, **not a legal person**. The shared-room secret still carries confidentiality; anyone who obtains it can read stored ciphertext.

Read [SECURITY_0_5.md](SECURITY_0_5.md) for the complete current threat model and limitations.

**Use only fabricated test messages. Do not send passwords, payment, health, identity or intimate information.**
