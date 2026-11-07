import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), 'koncha-model-'));
  const files = [
    'public/models/Xenova/opus-mt-ja-en/onnx/encoder_model_quantized.onnx',
    'public/local-translation.worker.js',
    'public/vendor/onnx/onnxruntime.wasm'
  ];
  for (const name of files) {
    await mkdir(join(root, name, '..'), { recursive:true });
    await writeFile(join(root, name), Buffer.from('example-weights-not-for-inference'));
  }
  const expected = createHash('sha256').update('example-weights-not-for-inference').digest('hex');
  const manifest = { schema:1, pairs:{ 'ja-en':{
    repo:'Xenova/opus-mt-ja-en', revision:'f'.repeat(40), license:'Apache-2.0',
    sha256:{ 'onnx/encoder_model_quantized.onnx':expected }
  } } };
  await writeFile(join(root, 'public/models/manifest.json'),JSON.stringify(manifest));
  return {root,manifest};
}
const run = root => spawnSync(process.execPath,['scripts/verify-local-ai.mjs','--root',root], {encoding:'utf8'});

test('local model verification detects valid files and checksum corruption', async () => {
  const {root} = await fixture();
  try {
    let result = run(root);
    assert.equal(result.status,0,result.stderr);
    assert.match(result.stdout,/ja-en/);
    await writeFile(join(root,'public/models/Xenova/opus-mt-ja-en/onnx/encoder_model_quantized.onnx'),'corrupt');
    result = run(root);
    assert.notEqual(result.status,0);
    assert.match(result.stderr,/checksum mismatch/);
  } finally {await rm(root,{recursive:true,force:true});}
});

test('local model verifier rejects asset path traversal', async () => {
  const {root,manifest} = await fixture();
  try {
    manifest.pairs['ja-en'].sha256={'../../../../secrets':'a'.repeat(64)};
    await writeFile(join(root,'public/models/manifest.json'),JSON.stringify(manifest));
    const result = run(root);
    assert.notEqual(result.status,0);
    assert.match(result.stderr,/path traversal/);
  } finally {await rm(root,{recursive:true,force:true});}
});
