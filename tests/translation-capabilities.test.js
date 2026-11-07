import test from 'node:test';
import assert from 'node:assert/strict';
import { translationCapabilities } from '../public/translation-capabilities.js';

test('capability check never claims a local WASM model is bundled', async () => {
  const none = await translationCapabilities({ navigator: {}, WebAssembly });
  assert.deepEqual(none, {native:false,webGPU:false,wasm:true,localModelBundled:false});
  const native = await translationCapabilities({
    Translator:{availability(){},create(){}},
    navigator:{ gpu: {async requestAdapter(){return {};}} }, WebAssembly
  });
  assert.equal(native.native, true);
  assert.equal(native.webGPU, true);
  assert.equal(native.localModelBundled, false);
});
