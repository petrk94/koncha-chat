import test from 'node:test';
import assert from 'node:assert/strict';
import { browserTranslation } from '../public/translation.js';

test('translation gracefully refuses unsupported browsers without server fallback', async () => {
  const saved = globalThis.Translator;
  try {
    delete globalThis.Translator;
    await assert.rejects(browserTranslation(), /On-device model/);
  } finally { if (saved) globalThis.Translator = saved; }
});

test('translation uses browser-local API and destroys its session', async () => {
  const saved = globalThis.Translator;
  const calls = [];
  try {
    globalThis.Translator = {
      async availability(args) { calls.push(['availability', args]); return 'available'; },
      async create(args) {
        calls.push(['create', args]);
        return { async translate(text) { calls.push(['translate', text]); return 'Hallo!'; },
          destroy() { calls.push(['destroy']); } };
      }
    };
    const worker = await browserTranslation();
    await worker.prepare('ja', 'de');
    assert.equal(await worker.translate('こんにちは', 'ja', 'de'), 'Hallo!');
    assert.equal(await worker.translate('こんにちは', 'ja', 'de'), 'Hallo!');
    worker.dispose();
    await new Promise(resolve => setTimeout(resolve, 0));
    assert.equal(calls.filter(c => c[0] === 'create').length, 1);
    assert.equal(calls.some(c => c[0] === 'destroy'), true);
  } finally { if (saved) globalThis.Translator = saved; else delete globalThis.Translator; }
});

test('native Translator with unsupported pair falls back to self-hosted local worker only', async () => {
  const previous = {Translator:globalThis.Translator, Worker:globalThis.Worker, fetch:globalThis.fetch};
  const network = [];
  class FakeWorker {
    postMessage(data) {
      queueMicrotask(()=>this.onmessage?.({data:{id:data.id,kind:'done',text:data.kind==='translate'?'local:' + data.text:null}}));
    }
    terminate() {}
  }
  try {
    globalThis.Translator = {availability:async()=> 'unavailable',create:async()=>{throw Error('not supported');}};
    globalThis.Worker = FakeWorker;
    globalThis.fetch = async (...args) => { network.push(args); return {ok:true}; };
    const translator = await browserTranslation();
    await translator.prepare('ja','de');
    assert.equal(await translator.translate('おはよう', 'ja','de'),'local:おはよう');
    assert.deepEqual(network.map(x=>x[0]),['/local-translation.worker.js']);
    translator.dispose();
  } finally {
    for(const [key,value] of Object.entries(previous)) {
      if (value === undefined) delete globalThis[key];
      else globalThis[key] = value;
    }
  }
});
