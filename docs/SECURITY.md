# Security status — EXPERIMENTAL / DO NOT USE FOR SECRETS

This project has NOT been independently audited. The prototype encrypts test-message bodies in the browser, but the shared-invite-key model lacks sender authentication, forward secrecy, post-compromise security and protection against an actively malicious server that can modify the delivered JavaScript.

**Do not send passwords, financial data, identification documents, medical information or intimate/private information.** Only use two-device tests with non-sensitive content.

### Known limitations

- Invite URLs contain a 256-bit one-time **invite token** after `#`, not the room secret. The relay retains a one-hour encrypted handoff and a verifier; the invite is single-use and a new invitation replaces the last. Anyone who redeems the token first obtains the room secret. The token still may leak via clipboard, screenshots, extensions or link forwarding. Expired claims are blocked, but server-side payload removal is lazy (at next access), not guaranteed at precisely 60 minutes.
- Invite expiry and revocation do not revoke the room secret held by established participants. Both participants use one room secret: either can forge messages from either displayed name.
- The relay sees room IDs, network connections, the timing of uploads and download requests, envelope sizes and request metadata.
- Not implementing SimpleX's SMP routing, its per-direction queues, Tor/onion transport, or ratchet.
- IndexedDB data and keys are accessible to scripts running with the app origin; device compromise or malicious third-party scripts defeat confidentiality.
- There is no guaranteed deletion from backups, recipients' devices or server snapshots.
- No account recovery, account takeover controls, abuse reporting, blocking identities, denial-of-service hardening or formal protocol audit. The local display name and random browser ID are not cryptographic identity verification.
- The PHP demo relay is single-instance file-backed. Do not put it behind multi-worker/multi-instance scaling without redesign.
- HTTP is permitted for localhost development only. Remote devices require **HTTPS** for browser cryptography.

### Minimal deployment hardening

- Never put `var/rooms` into any publicly served document root.
- Enforce HTTPS/HSTS at the front server and avoid injecting third-party scripts.
- Set `Referrer-Policy: no-referrer`, strong CSP, `Cache-Control: no-store` on API and disable access logs where compliant and possible.
- Keep PHP and TLS infrastructure current and review filesystem permissions.
- Do not enable analytics, advertising, telemetry, third-party translation or remote AI by default. The native on-device translator can download its model after explicit consent; external model hosts should not receive message plaintext. WebGPU/WASM worker fallback is not yet included.

Report vulnerabilities privately to the project maintainer; do not publish exploitable details in a public issue.

### Screenshots and backups

Web applications cannot reliably prevent, detect or notify about screenshots or filming the screen. Never claim screenshot protection for the PWA. Browser backups/sync, other software, or the recipient may retain copies outside our control.
