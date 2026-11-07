# Local-only translation design (Koncha 0.2)

## Non-negotiable privacy rule

Chat plaintext may be processed for translation **only on the recipient's own device**. Do not send chat text to a Koncha API endpoint, cloud LLM or external translation service as an automatic fallback. No analytics, trackers or runtime third-party scripts may be given access to decrypted messages. Translation is disabled by default and must be enabled deliberately in conversation settings.

## Implemented in this version

- `public/translation.js` provides a replaceable provider interface, currently using the browser's **on-device** `Translator` API where available.
- Feature detection checks the actual browser API. No UA sniffing, no server request for text.
- The caller's original plaintext remains unchanged; translations are ephemeral UI decorations rather than changes to the encrypted message.
- A session is prepared only after user consent and destroyed when disabled or leaving the room.
- Explicit error and original-text fallback when the current browser / requested language pair cannot run a local model.

## Planned: cross-browser WebGPU/WASM worker

The built-in Translator API is still not generally supported in Firefox, Safari, or mobile Chrome. We therefore need a second **browser-side** runtime for iOS and Android:

1. Choose a verified commercial-use-compatible multilingual translation model for DE/EN/JA. Check the **exact converted model** license, original model license, required attribution, model size and compatibility with Safari. Do not use NLLB-200-distilled-600M (CC BY-NC 4.0) without a separate commercial license.
2. Use a self-hosted, pinned JavaScript inference bundle (e.g. Transformers.js) inside a Web Worker. Prefer WebGPU; fall back to CPU/WASM if device resources permit. Keep WASM binaries and JavaScript files on the Koncha origin instead of importing live code from public CDNs.
3. Only download model weights after explicit user action; present model download sizes, source, cache use and IP/network disclosure. For stronger privacy, self-host weights on the Koncha domain with version checksums and model-license notices. Loading model *weights* from an external provider is not a cloud inference call, but does disclose a network request to that provider.
4. Use browser Cache Storage / IndexedDB appropriately and expose a model removal control; storage quotas and eviction differ by browser, especially on iOS.
5. Run inference in a Web Worker to avoid UI lock-ups; bound input lengths, worker memory, maximum concurrent requests, and provide cancellation/progress/error states.
6. Test real iPhone Safari/PWA and Android Chrome. Do not assume WebGPU presence or adequate RAM just because the API exists.
7. Provide no translation if a model cannot run. Never silently invoke a remote service.

## Language detail

- Start with explicit source language per conversation; reliably detecting the sender language is separate work.
- Distinguish kana transliteration (non-LLM, currently implemented) from kanji readings/furigana and semantic translation.
- Preserve Japanese IME composition in the composer: Enter must not send while candidates are being selected.
- Never treat a machine translation as an authenticated original message. The original is always visible.

## References (ideas, not copied code)

- https://publishing-project.rivendellweb.net/client-side-translation/
- https://dev.to/lightningdev123/unlocking-client-side-ai-running-llms-in-the-browser-with-webgpu-15nc
- https://developer.chrome.com/docs/ai/translator-api
- https://huggingface.co/docs/transformers.js/api/env
- https://huggingface.co/Xenova/nllb-200-distilled-600M (NON-COMMERCIAL; do not bundle)
- https://huggingface.co/onnx-community/opus-mt-ja-en (candidate only, attribution/license review required)
