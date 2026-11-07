import { localWorkerTranslation } from './local-translation.js';

/**
 * Device-only translation: prefer browser native API where this exact pair is
 * supported, otherwise use a previously provisioned SAME-ORIGIN ONNX Worker.
 * NEVER send plaintext to an HTTP API or third-party inference service.
 */
export async function browserTranslation({ status = () => {} } = {}) {
  const Native = globalThis.Translator;
  if (!Native?.availability || !Native?.create) {
    try { return await localWorkerTranslation({ status }); }
    catch (error) { throw new Error(`On-device model not installed for this browser (${error.message})`); }
  }
  const sessions = new Map();
  let localWorkerPromise = null;
  let disposed = false;
  const local = () => {
    if (!localWorkerPromise) localWorkerPromise = localWorkerTranslation({status});
    return localWorkerPromise;
  };
  async function forPair(from, to) {
    if (disposed) throw new Error('Translation session closed');
    if (from === to) return null;
    const key = `${from}:${to}`;
    if (!sessions.has(key)) {
      const promise = (async () => {
        let availability = 'unavailable';
        try { availability = await Native.availability({sourceLanguage:from,targetLanguage:to}); }
        catch { /* Native browser API unavailable for this pair; local-only fallback. */ }
        if (availability !== 'unavailable') {
          if (availability === 'downloadable' || availability === 'downloading') status('Loading browser on-device model…');
          const translator = await Native.create({sourceLanguage:from,targetLanguage:to});
          return {kind:'native',engine:translator};
        }
        const worker = await local();
        await worker.prepare(from,to);
        return {kind:'worker',engine:worker};
      })().catch(e => { sessions.delete(key); throw e; });
      sessions.set(key, promise);
    }
    return sessions.get(key);
  }
  return {
    async prepare(from, to) { await forPair(from,to); },
    async translate(text, from, to) {
      if (from === to) return text;
      const session = await forPair(from,to);
      if (disposed) throw new Error('Translation session closed');
      return session.kind === 'worker' ? session.engine.translate(text,from,to) : session.engine.translate(text);
    },
    dispose() {
      disposed = true;
      for (const promise of sessions.values()) void promise.then(s => { if (s.kind === 'native') s.engine?.destroy?.(); }).catch(()=>{});
      sessions.clear();
      if (localWorkerPromise) void localWorkerPromise.then(w => w.dispose()).catch(()=>{});
    }
  };
}
