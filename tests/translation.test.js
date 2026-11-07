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
