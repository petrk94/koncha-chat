# Koncha v0.6.0-alpha.1 — partial migration and local AI groundwork

Status: testing/PR candidate. Not a beta release or safe messenger.

### Added
- Offline app shell: service worker network-first caches static app files *after onboarding consent*, never `/api.php` or private chat data. Cached saved rooms can open offline; attempting to send still requires network.
- PWA device diagnostic panel in DE/EN/JA for secure context, installed mode, service worker, Push API, browser notification permissions, IndexedDB, WASM and WebGPU.
- Optional Web Worker translation pipeline: `src/local-translation.worker.js` uses Transformers.js + ONNX Runtime Web, four candidate pairs plus JA⇄DE via EN. Model weights and JS/WASM compiled assets are **not included**. `scripts/build-local-ai.mjs` and `scripts/prepare-models.py` support supervised provisioning on a developer machine. No cloud text inference.
- `public/protocol-status.js` fails closed when asked to claim forward-secret independently audited E2EE; documentation evaluates vodozemac/Olm and necessary migration gates.
- Unit tests for worker message transport, privacy boundaries, PWA capabilities and protocol-status claims.

### Still NOT complete
- No vodozemac, Double Ratchet, forward secrecy or independently reviewed production E2EE. Existing v0.5 experimental shared-room-key protocol remains in use.
- Real ONNX inference build, model integrity, quality, size, licensing and mobile performance unverified in this isolated build environment.
- No real iPhone/Android hardware tests; no closed-app Web Push delivery. Service-worker app-shell caching is NOT offline message delivery.

### Test run
- `npm test` (34 passing), `php -l public/api.php`, JS syntax checks.
- Browser smoke in hosted isolated environment failed due `net::ERR_BLOCKED_BY_ADMINISTRATOR` for loopback, not a browser app result.
