# Third-party software inventory

Initial prototype: **no external runtime packages or copied third-party source code**.

- PHP 8.2+ (runtime): PHP License, provided by the hosting environment.
- Browser Web Crypto API, IndexedDB, Service Workers, Web APIs (browser capabilities, not bundled libraries).
- Node.js 20+ for the optional test runner (not shipped in the web deployment).

References to the SimpleX SMP protocol are **architectural research only**. No SimpleX source, names, logos or graphical assets are embedded in this project.

Adding a dependency requires license review and a new inventory entry before merging.

## 0.2 translation runtime

The demo uses the **built-in browser Translator API only** (when present). No runtime third-party translation library or model weights are bundled, and none of the model repositories mentioned in docs are included. A WebGPU/WASM worker will require a separate exact-library-and-model license review before deployment.

## Koncha 0.6 optional local translation toolchain (not in Git bundle)

- `@huggingface/transformers@3.8.1` (Transformers.js, Apache-2.0; runtime intended for a locally built worker). **Not installed or vendor-bundled in this branch.**
- `esbuild@0.25.12` (MIT; development bundler). Version pinned in `package.json`, but no lockfile can be generated in this offline environment. Generate and commit a reviewed `package-lock.json` from a trusted networked developer system before beta.
- ONNX Runtime Web is a transitive dependency of Transformers.js; bundle and WASM artifacts should be served from the Koncha origin and their exact versions audited during `npm install`.
- Python `huggingface_hub` is optional developer provisioning tooling. The script records model revision SHAs and file digests; the original and converted model terms must both be reviewed before commercial packaging.
- Model candidate metadata/licensing and warnings: `docs/LOCAL_AI_0_6.md`.
- The chosen Matrix cryptography candidate (`vodozemac` / `matrix-sdk-crypto-wasm`) is research-only and is **not** included as a dependency. See `docs/SECURITY_PROTOCOL_0_6.md`.


## 0.7 Web Push and model verification

- **No new npm/runtime network library**: PHP OpenSSL (ECDSA P-256 ES256 JWT) and PHP cURL implement a minimal EMPTY-payload Web Push sender. PHP cURL is required on the server for enabling Web Push, and is absent in some development environments. An actual live vendor delivery test has not yet been performed.
- `scripts/verify-local-ai.mjs`: Node built-in `crypto`, `fs` and `path` only. Verifies the SHA-256 manifest and self-hosted model files; it does not license-audit, install or run models.
- Web Push protocol references: RFC 8030 (Web Push), RFC 8292 (VAPID). Browser Push API and Service Worker are web platform capabilities.
