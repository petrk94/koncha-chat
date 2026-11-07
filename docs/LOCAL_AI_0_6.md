# Koncha 0.6 — On-device translation (optional build, not bundled)

## Implementation present

- Browser-native Translator API where available, without an external inference service.
- **Actual ONNX inference worker source** at `src/local-translation.worker.js` using Transformers.js, ONNX Runtime Web and CPU/WASM. It supports `ja→en`, `en→ja`, `de→en`, `en→de`. German↔Japanese is composed via English, which needs separate quality testing.
- Browser-side controller `public/local-translation.js` loads the built worker from the same Koncha origin, with a capped request queue and no cloud text fallback.
- Models are fetched from `/models/` **on the Koncha origin** only after explicit translation opt-in; the worker sets `env.allowRemoteModels=false`, and WebAssembly assets are served from `/vendor/onnx/`. On first use the browser can download **hundreds of MB** and retain weights in its browser cache, subject to eviction.
- **The runtime bundle, WASM binaries and model weights are NOT committed**, and are not installed by `npm test` or the ordinary PHP development server. Until assets are provisioned, the UI correctly reports translation unavailable. Code and worker transport have unit tests, **real model inference has not been validated here**.

## Provisioning for controlled device tests

Use the existing repository, not a new ZIP copy:

```bash
cd ~/Downloads/koncha-chat
npm install                           # installs pinned development packages
npm run ai:build                     # bundles JS and stages ONNX WASM assets
python3 -m pip install huggingface_hub
python3 scripts/prepare-models.py ja-en en-ja de-en en-de
php -S 127.0.0.1:8787 -t public
```

The model script retrieves the current Hugging Face repository SHA, downloads only quantized ONNX plus tokenizer/config files from the specified repository, and writes `public/models/manifest.json` containing the revision and SHA-256 hashes. Once prepared, **freeze and review the manifest** before real-world deployment. The scripts do not upload decrypted messages, but *developer provisioning* contacts Hugging Face and transmits the developer machine's network metadata. User devices later fetch weights from the Koncha server.

The `/public/vendor/`, `/public/models/` and built worker are ignored by Git: publish them via a separate reviewed deployment step, **not** a GitHub PR. Treat the model weights and JavaScript as executable supply-chain inputs. Review every pinned model conversion and its exact license/attribution requirements before commercial deployment.

## Candidate models (research stage, not quality- or supply-chain-approved)

| Pair | ONNX repo | Base repo | Reported base license |
| --- | --- | --- | --- |
| JA → EN | `Xenova/opus-mt-ja-en` | `Helsinki-NLP/opus-mt-ja-en` | Apache-2.0 |
| EN → JA | `Xenova/opus-mt-en-jap` | `Helsinki-NLP/opus-mt-en-jap` | Apache-2.0 |
| DE → EN | `Xenova/opus-mt-de-en` | `Helsinki-NLP/opus-mt-de-en` | Apache-2.0 |
| EN → DE | `Xenova/opus-mt-en-de` | `Helsinki-NLP/opus-mt-en-de` | CC BY 4.0 (attribution required) |

Model conversions may have their own terms. This table is **not** a completed legal review. Avoid NLLB-200 (CC BY-NC) for this commercial project.

## Device acceptance test (not yet complete)

1. On desktop Chromium and Firefox, provision one model pair, enable translation and watch first-download progress. Use the original test string and ensure it remains visible alongside translated text.
2. In DevTools Network, verify only same-origin model/WASM requests and **no plaintext translation HTTP POST**. Check no runtime calls to an external inference API.
3. Disconnect network after model/cache is ready; confirm a previously loaded pair translates offline while the PWA remains running. Cache eviction may change this.
4. On iPhone Safari tab and installed PWA, test memory consumption, unsupported API behavior, model caching and fallback. Safari WebGPU presence is not assumed; WASM is the baseline.
5. Repeat on Android Chrome/PWA. Confirm Japanese input, multi-language fragments, English pivot, emoji, URLs, cancellation and model loading errors. Record device/browser versions, original/translation, size, latency and wrong translations.
6. Re-test service worker updates and model deletion. Never imply good translation quality merely because the model ran successfully.
