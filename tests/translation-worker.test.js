import test from 'node:test';
import assert from 'node:assert/strict';
import { localWorkerTranslation } from '../public/local-translation.js';

class LocalFakeWorker {
  constructor(url, opts) { this.url = url; this.opts = opts; this.messages = []; }
  postMessage(data) {
    this.messages.push(data);
    queueMicrotask(() => this.onmessage?.({data: {id: data.id, kind: 'done', text: data.kind === 'translate' ? `local:${data.text}` : null}}));
  }
  terminate() { this.stopped = true; }
}

test('worker runs only after same-origin runtime is available; no message content sent with fetch', async () => {
  const network = [];
  const worker = await localWorkerTranslation({ WorkerClass: LocalFakeWorker,
    fetchFn: async (...args) => { network.push(args); return {ok:true}; } });
  await worker.prepare('ja','de');
  assert.equal(await worker.translate('こんにちは', 'ja', 'de'), 'local:こんにちは');
  assert.deepEqual(network, [['/local-translation.worker.js', { method:'HEAD', cache:'no-store', credentials:'omit' }]]);
  worker.dispose();
  await assert.rejects(worker.translate('secret','ja','en'), /closed/);
});

test('no worker runtime means translation unavailable, never a remote AI fallback', async () => {
  await assert.rejects(localWorkerTranslation({WorkerClass:LocalFakeWorker,fetchFn:async()=>({ok:false})}), /not installed/);
});
