# Issue: On-device WebGPU/WASM translation for iPhone, Android, Firefox and Safari

## User need

Translate private messages in Japanese / German / English **inside the recipient's browser**. Do not call a remote AI service or send decrypted messages to the relay. Differentiate application UI locale from private message translation.

## Current state (0.2.0-alpha.1)

The application language switch and opt-in `public/translation.js` adapter are implemented. It currently uses the browser built-in `Translator` API, when provided and when a language pair is available. **No WebGPU/WASM model is included yet.** Safari and Firefox will show a feature-unavailable message; original message text stays visible.

## Requested follow-up implementation

1. Review license/quality/size for specific multilingual translation model weights and converted ONNX variants. Exclude `CC BY-NC` models from a commercial-ready release.
2. Pin the version of a compatible browser inference library and self-host JavaScript, WASM and weights under the Koncha origin. Supply checksums, copyright notices and licenses.
3. Implement a dedicated `Worker` module with `init`, `translate`, `progress`, `cancel` and `release` messages. Prefer WebGPU when available; fallback to CPU/WASM for iOS Safari, Firefox and devices lacking usable WebGPU. No third-party runtime scripts.
4. Ask permission before a model download. Explain storage consumption, device CPU/memory effects and the fact that an external model host sees network metadata if one is chosen. Prefer self-hosting.
5. Never transmit chat plaintext to the relay or an external provider for translation. Do not add fallback to a cloud model.
6. Preserve URL/email/code fragments and original text; handle mixed-language messages, emoji, Japanese politeness, shorter texts and model hallucinations defensively. Translation is a visual aid, not the authoritative message.
7. Support explicit source/target language per chat. Add optional language detection only after short-message quality measurements.
8. Implement resource limits: download progress, model cache cleanup, memory budgets, queue size, cancellation, and timeout controls.
9. Manually test real iPhone Safari PWA, iPhone Safari tab, Android Chrome PWA, Firefox desktop and Chromium desktop; document results.

## Acceptance criteria

- On-device JA↔EN and DE↔EN (or a documented staged-pivot translation) works in real Safari and Android browsers after consent and initial model download.
- Offline inference works after assets are cached; offline cache may be subject to browser eviction.
- Browser network inspection shows no plaintext translation requests.
- A disabled or failing local model leaves the original text unchanged; user receives clear feedback.
- Licenses, model attribution and exact hashes are documented.
- Unit, integration, failure, regression and mobile device tests cover changes.

## Reading

- https://publishing-project.rivendellweb.net/client-side-translation/
- https://dev.to/lightningdev123/unlocking-client-side-ai-running-llms-in-the-browser-with-webgpu-15nc
- https://huggingface.co/docs/transformers.js/api/env
- https://developer.chrome.com/docs/ai/translator-api

The solution must be compatible with `AGENTS.md`, `docs/SECURITY.md` and `docs/LOCAL_TRANSLATION.md`.
