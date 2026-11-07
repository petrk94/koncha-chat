# Third-party software inventory

Initial prototype: **no external runtime packages or copied third-party source code**.

- PHP 8.2+ (runtime): PHP License, provided by the hosting environment.
- Browser Web Crypto API, IndexedDB, Service Workers, Web APIs (browser capabilities, not bundled libraries).
- Node.js 20+ for the optional test runner (not shipped in the web deployment).

References to the SimpleX SMP protocol are **architectural research only**. No SimpleX source, names, logos or graphical assets are embedded in this project.

Adding a dependency requires license review and a new inventory entry before merging.

## 0.2 translation runtime

The demo uses the **built-in browser Translator API only** (when present). No runtime third-party translation library or model weights are bundled, and none of the model repositories mentioned in docs are included. A WebGPU/WASM worker will require a separate exact-library-and-model license review before deployment.
