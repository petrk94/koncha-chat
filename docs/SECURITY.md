# Security status — EXPERIMENTAL / DO NOT USE FOR SECRETS

This project has NOT been independently audited. The prototype encrypts test-message bodies in the browser, but the shared-invite-key model lacks sender authentication, forward secrecy, post-compromise security and protection against an actively malicious server that can modify the delivered JavaScript.

**Do not send passwords, financial data, identification documents, medical information or intimate/private information.** Only use two-device tests with non-sensitive content.

### Known limitations

- Invite URLs contain the decryption secret after `#`. Browser fragments are omitted from HTTP requests but can leak via screenshots, device clipboard sync, extensions, sharing or compromise.
- Both participants use one room secret: either can forge messages from either displayed name.
- The relay sees room IDs, network connections, the timing of uploads and download requests, envelope sizes and request metadata.
- Not implementing SimpleX's SMP routing, its per-direction queues, Tor/onion transport, or ratchet.
- IndexedDB data and keys are accessible to scripts running with the app origin; device compromise or malicious third-party scripts defeat confidentiality.
- There is no guaranteed deletion from backups, recipients' devices or server snapshots.
- No account takeover controls, abuse reporting, blocking identities, denial-of-service hardening or formal protocol audit.
- The PHP demo relay is single-instance file-backed. Do not put it behind multi-worker/multi-instance scaling without redesign.
- HTTP is permitted for localhost development only. Remote devices require **HTTPS** for browser cryptography.

### Minimal deployment hardening

- Never put `var/rooms` into any publicly served document root.
- Enforce HTTPS/HSTS at the front server and avoid injecting third-party scripts.
- Set `Referrer-Policy: no-referrer`, strong CSP, `Cache-Control: no-store` on API and disable access logs where compliant and possible.
- Keep PHP and TLS infrastructure current and review filesystem permissions.
- Do not enable analytics, advertising, telemetry, third-party translation or remote AI by default.

Report vulnerabilities privately to the project maintainer; do not publish exploitable details in a public issue.
