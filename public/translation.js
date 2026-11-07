import { localWorkerTranslation } from './local-translation.js';

/**
 * Koncha client-only translation adapter. No plaintext is sent to our relay or a cloud AI.
 * The native Translator API is used where supported. The optional self-hosted
 * WebGPU/WASM worker is planned separately; do not silently fall back to a remote API.
 */
export async function browserTranslation({ status = () => {} } = {}) {
  const NativeTranslator = globalThis.Translator;
  if (!NativeTranslator?.availability || !NativeTranslator?.create) {
    try { return await localWorkerTranslation({ status }); }
    catch (error) { throw new Error(`On-device model not installed for this browser (${error.message})`); }
  }
  const translators = new Map();
  let disposed = false;
  async function forPair(from, to) {
    if (disposed) throw new Error('Translation session closed');
    if (from === to) return null;
    const pair = `${from}:${to}`;
    if (!translators.has(pair)) {
      const create = (async () => {
        const availability = await NativeTranslator.availability({ sourceLanguage: from, targetLanguage: to });
        if (availability === 'unavailable') throw new Error('Language pair unavailable on device');
        if (availability === 'downloadable' || availability === 'downloading') status('Loading on-device model…');
        return NativeTranslator.create({ sourceLanguage: from, targetLanguage: to });
      })();
      translators.set(pair, create);
    }
    return translators.get(pair);
  }
  return {
    async prepare(from, to) { return forPair(from, to); },
    async translate(text, from, to) {
      if (from === to) return text;
      const translator = await forPair(from, to);
      if (disposed) throw new Error('Translation session closed');
      return translator.translate(text);
    },
    dispose() {
      disposed = true;
      for (const promise of translators.values()) void promise.then(translator => translator?.destroy?.()).catch(() => {});
      translators.clear();
    }
  };
}
