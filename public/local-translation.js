/**
 * Client-only translation worker controller. The worker and model weights must be
 * self-hosted. Models are NOT bundled into the source repository.
 */
export async function localWorkerTranslation({ status = () => {}, WorkerClass = globalThis.Worker, workerUrl = '/local-translation.worker.js', fetchFn = globalThis.fetch } = {}) {
  if (typeof WorkerClass !== 'function') throw new Error('No Web Worker support');
  const response = await fetchFn(workerUrl, { method: 'HEAD', cache: 'no-store', credentials: 'omit' });
  if (!response.ok) throw new Error('Local model runtime is not installed on this server');
  const worker = new WorkerClass(workerUrl, { type: 'module', name: 'koncha-local-translation' });
  let sequence = 0;
  let disposed = false;
  const requests = new Map();
  worker.onmessage = event => {
    const { id, kind, text, error, loaded, total } = event.data || {};
    const p = requests.get(id);
    if (!p) return;
    if (kind === 'progress') { status(total ? `Model: ${Math.floor(100 * loaded / total)}%` : 'Loading local model…'); return; }
    requests.delete(id);
    if (kind === 'done') p.resolve(text);
    else p.reject(new Error(error || 'Translation failed'));
  };
  worker.onerror = () => {
    for (const p of requests.values()) p.reject(new Error('Local translation worker failed'));
    requests.clear();
    worker.terminate(); disposed = true;
  };
  const call = (kind, extra) => {
    if (disposed) return Promise.reject(new Error('Worker closed'));
    if (requests.size >= 8) return Promise.reject(new Error('Too many translation requests'));
    const id = ++sequence;
    return new Promise((resolve, reject) => {
      requests.set(id, { resolve, reject });
      worker.postMessage({ id, kind, ...extra });
    });
  };
  return {
    prepare(from, to) { return call('prepare', { from: from === 'ja' && to === 'de' ? 'ja' : from === 'de' && to === 'ja' ? 'de' : from, to: from !== 'en' && to !== 'en' ? 'en' : to }); },
    translate(text, from, to) { return from === to ? Promise.resolve(text) : call('translate', { text, from, to }); },
    dispose() {
      disposed = true;
      for (const p of requests.values()) p.reject(new Error('Worker closed'));
      requests.clear(); worker.terminate();
    }
  };
}
