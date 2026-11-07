/**
 * Optional Transformers.js v3 ONNX translation worker. All inference stays on-device.
 * Build with `npm run ai:build` and serve from the Koncha origin.
 * Models are hosted on the Koncha origin, and remote model loading is DISABLED.
 */
import { pipeline, env } from '@huggingface/transformers';

env.allowLocalModels = true;
env.allowRemoteModels = false;
env.localModelPath = '/models/';
env.useBrowserCache = true;
env.backends.onnx.wasm.wasmPaths = '/vendor/onnx/';

const pairs = Object.freeze({
  'de-en': 'Xenova/opus-mt-de-en',
  'en-de': 'Xenova/opus-mt-en-de',
  'ja-en': 'Xenova/opus-mt-ja-en',
  'en-ja': 'Xenova/opus-mt-en-jap',
});
let current = null;
let key = '';
let modelPromise = null;
let pending = Promise.resolve();

async function getModel(from, to, id) {
  const name = `${from}-${to}`;
  const model = pairs[name];
  if (!model) throw new Error('language_pair_not_supported');
  if (key !== name) {
    current?.dispose?.();
    key = name;
    modelPromise = pipeline('translation', model, {
      device: 'wasm', dtype: 'q8',
      progress_callback: progress => {
        if (progress?.status === 'progress') postMessage({ id, kind: 'progress', loaded: progress.loaded || 0, total: progress.total || 0 });
      },
    }).catch(e => { key = ''; modelPromise = null; throw e; });
  }
  current = await modelPromise;
  return current;
}
async function oneStep(text, from, to, id) {
  const translator = await getModel(from, to, id);
  const result = await translator(text, { max_new_tokens: 256 });
  if (!result?.[0] || typeof result[0].translation_text !== 'string') throw new Error('no_translation');
  return result[0].translation_text;
}
async function translated(text, from, to, id) {
  if (from === to) return text;
  if (!['de', 'en', 'ja'].includes(from) || !['de', 'en', 'ja'].includes(to)) throw new Error('language_pair_not_supported');
  // Japanese/German pair uses English as pivot; output quality requires evaluation.
  if (from !== 'en' && to !== 'en') return oneStep(await oneStep(text, from, 'en', id), 'en', to, id);
  return oneStep(text, from, to, id);
}
self.onmessage = event => {
  const { id, kind, text, from, to } = event.data || {};
  if (!Number.isSafeInteger(id)) return;
  if (kind === 'dispose') { pending = pending.then(() => current?.dispose?.()); current = null; modelPromise = null; key = ''; postMessage({ id, kind: 'done' }); return; }
  if (!['translate', 'prepare'].includes(kind)) return;
  // Explicit queue prevents simultaneous model swaps, capped text size.
  pending = pending.catch(() => {}).then(async () => {
    if (kind === 'translate' && (typeof text !== 'string' || text.length > 2000)) throw new Error('invalid_text');
    const result = kind === 'prepare' ? await getModel(from, to, id).then(() => null) : await translated(text, from, to, id);
    postMessage({ id, kind: 'done', text: result });
  }).catch(e => postMessage({ id, kind: 'error', error: String(e?.message || 'worker_error').slice(0, 200) }));
};
