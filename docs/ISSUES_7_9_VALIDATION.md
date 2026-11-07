# Koncha issues #7–#9: verification and release gates

**Status:** A three-part integration evidence pipeline is available; **none of #7, #8 or #9 should be closed solely because CI is green.** Koncha's legacy chat encryption still has no Forward Secrecy, real browser translation depends on separately installed model weights, and physical device acceptance remains manual.

## #7 — Forward-secret E2EE (blocking)

- `scripts/olm-wasm-probe.mjs` loads the Apache-2.0 Matrix Rust crypto WASM implementation version `19.0.0` from npm and creates distinct Olm device identities.
- The smoke test does NOT establish an Olm session, transport prekeys, decrypt ratcheted messages, bind QR fingerprints to Matrix identities, persist ratchet state, or implement recoveries.
- Never convert a `koncha-shared-room-key-v1` room into a supposed secure room by simply changing its label. `public/protocol-status.js` must retain `forwardSecret:false`, `postCompromiseSecure:false`, `independentlyAudited:false` and `productionReady:false` until the full protocol and deployment have been independently reviewed.
- Remaining work: Matrix-compatible key distribution and to-device messaging through a suitable relay, verified identity-key binding, encrypted session state with concurrency control, recovery/rotation, reordering and replay tests, verified migration, library license/integrity inventory and external review.
- Official source: https://github.com/matrix-org/vodozemac ; browser binding: https://matrix-org.github.io/matrix-sdk-crypto-wasm/

## #8 — local browser translation (blocking)

- The chat settings **Check local translation** button now (when the device has a native translator or same-origin local worker files) requests explicit consent before executing a fixed, public demonstration sentence in the selected pair. It reports real result text and elapsed time only after inference succeeds, not after detecting a model manifest.
- It never sends chat plaintext and does not use cloud inference. Failures leave the chat and original messages unchanged.
- `scripts/real-model-inference.mjs` runs a real, non-mocked ONNX translation in Node with `env.allowRemoteModels=false` against downloaded on-disk weights, and CI checks the manifest hashes.
- **Node inference success is not proof of successful browser WASM inference, correct translation, Safari memory tolerance or commercial licensing.**
- For real device acceptance, serve the bundled local worker, WASM and reviewed DE/EN/JA models from HTTPS on the same origin, run the built-in test on each real device, inspect DevTools Network for off-origin fetches, verify offline after caching, then record latency, memory, language quality and hashes.
- Do not ship NLLB (CC BY-NC) weights in a commercially intended Koncha build without separate permission.

## #9 — PWA real device tests (blocking)

- `tests/browser-engine-probe.py` runs real desktop Chromium, Firefox and WebKit, checks a 390 × 844 viewport, the registered offline app shell and confirms neither /api.php nor /models is cached by the service worker.
- `tests/browser-smoke.py` exercises a multi-profile chat, one-time invite, signatures, two separate rooms and hidden-tab notification counts in desktop Chromium.
- These tests do **NOT** verify iOS Safari/WebKit on hardware, Android Web Push, closed-app vendor notification delivery, app installation or iOS storage eviction.

### Physical device acceptance record

Use **only invented messages** and a non-public HTTPS staging server with a configured PHP VAPID private key outside document root. On each device record:
- Device type, operating system/build, browser build, standalone vs browser-tab state and timestamp (no personally identifying device IDs).
- Installation/add-to-home-screen result, first launch, refresh, app close/reopen, Service Worker activation and offline re-opening.
- Invitation, distinct rooms, encrypted offline mailbox, explicit Push permission granted/refused, generic closed-PWA Push delivery and tap-to-open.
- Local DE↔EN and JA↔EN translation result, original preserved, whether model download and cache worked, actual network destinations.
- Test **both** iPhone Safari installed PWA (Apple iOS >=16.4) and Android Chrome installed PWA; repeat with notification permission denied. Never include real chat text, invitation URLs or Push endpoints in reports.

**Do not close issue #9 until physical iPhone and Android results with actual Push provider delivery have been recorded.** Emulation and CI cannot substitute.

## Reproduction

```sh
npm test
# To run browser engine tests locally after installing Playwright:
python -m pip install playwright==1.56.0
python -m playwright install chromium firefox webkit
python tests/browser-engine-probe.py
python tests/browser-smoke.py

# Optional network-enabled provisioning:
npm install
npm run ai:build
python -m pip install huggingface_hub
python scripts/prepare-models.py de-en
npm run ai:verify
node scripts/real-model-inference.mjs de-en

# Separate Matrix crypto library bootstrap, NOT a secure chat:
npm install --no-save --no-package-lock @matrix-org/matrix-sdk-crypto-wasm@19.0.0
node scripts/olm-wasm-probe.mjs
```

GitHub Actions workflow: `.github/workflows/integration-evidence.yml`. An integration failure is a genuine blocker, not a reason to weaken the test or claim success.
