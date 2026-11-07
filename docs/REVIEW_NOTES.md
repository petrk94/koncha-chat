# Review notes — 0.2.0-alpha.1

- Automated test suite: `npm test` (12 passing tests on Node 22 + PHP 8.4).
- Syntax checked with `node --check public/app.js`, `node --check public/translation.js`, `php -l public/api.php`.
- Optional Playwright smoke test updated for `#invite=` URLs and chat preferences; the runtime environment's Chromium blocks loopback connections with `net::ERR_BLOCKED_BY_ADMINISTRATOR` so visual two-browser verification remains **unperformed**.
- No production security claim. Current room shares one key between participants and lacks sender authentication, forward secrecy and robust replay/abuse protection.
- Invitation expiration is server-authoritative, limited to 3600 seconds; expired secret payload is lazily erased at next request. Browser UI checks pending invites periodically; it cannot prevent someone copying an invite off-device before redemption.
- Translation module is on-device only and opt-in. Cross-browser WebGPU/WASM model inference is documented but **not implemented**.
- Screenshot blocking is unavailable to ordinary PWAs.
- Read `docs/LOCAL_TRANSLATION.md` and `docs/issues/browser-local-translation-worker.md` before adding models.
