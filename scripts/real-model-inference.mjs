/**
 * Real, non-mocked local model inference test for CI/dev machines.
 * It processes a PUBLIC FIXED sentence; chat messages are never involved.
 * First provision models with scripts/prepare-models.py, then run:
 * npm install
 * node scripts/real-model-inference.mjs [de-en|en-de|ja-en|en-ja]
 */
import assert from 'node:assert/strict';
import { resolve, sep } from 'node:path';
import { pipeline, env } from '@huggingface/transformers';

const pairs = {
  'de-en': ['Xenova/opus-mt-de-en', 'Guten Morgen!'],
  'en-de': ['Xenova/opus-mt-en-de', 'Good morning!'],
  'ja-en': ['Xenova/opus-mt-ja-en', 'おはようございます。'],
  'en-ja': ['Xenova/opus-mt-en-jap', 'Good morning!'],
};
const pair = process.argv[2] || 'de-en';
if (!Object.hasOwn(pairs, pair)) throw new Error('Unsupported pair');
const [model, sentence] = pairs[pair];

// Nothing may be fetched from Hugging Face or a cloud translation endpoint
// at inference time. All weight provisioning is a separate developer step.
env.allowLocalModels = true;
env.allowRemoteModels = false;
env.localModelPath = resolve('public/models') + sep;
env.useBrowserCache = false;
const start = Date.now();
const translator = await pipeline('translation', model, {device:'cpu',dtype:'q8'});
try {
  const values = await translator(sentence, {max_new_tokens:80});
  const output = values?.[0]?.translation_text;
  assert.equal(typeof output, 'string', 'model did not return a translated sentence');
  assert.ok(output.trim().length > 0, 'model returned empty text');
  console.log(JSON.stringify({
    pair, model, elapsedMs:Date.now()-start, output, result:'inference-executed',
    warning:'This validates this Node runtime and a fixed public sentence, not iPhone/Safari or translation quality.'
  }));
} finally {
  await translator.dispose?.();
}
