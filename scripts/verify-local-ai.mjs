#!/usr/bin/env node
/** Verify all self-hosted model weights and runtime bundles before deployment. */
import { readFile, readdir, stat, open } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve, join, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
const project = resolve(fileURLToPath(new URL('../', import.meta.url)));
const root = resolve(process.argv.includes('--root') ? process.argv[process.argv.indexOf('--root') + 1] : project);
const models = resolve(root, 'public/models');
const manifestFile = join(models, 'manifest.json');
const allowedRepos = {
  'ja-en':'Xenova/opus-mt-ja-en',
  'en-ja':'Xenova/opus-mt-en-jap',
  'de-en':'Xenova/opus-mt-de-en',
  'en-de':'Xenova/opus-mt-en-de',
};
const fail = message => { throw new Error(`Model verification failed: ${message}`); };
const inside = (base, path) => path.startsWith(base + sep);
async function sha256(file) {
  const hash = createHash('sha256');
  const handle = await open(file, 'r');
  try { for await (const chunk of handle.createReadStream()) hash.update(chunk); }
  finally { await handle.close().catch(() => {}); }
  return hash.digest('hex');
}
async function verify(rootPath = root) {
  let manifest;
  try { manifest = JSON.parse(await readFile(manifestFile, 'utf8')); }
  catch { fail('manifest.json missing or invalid; run scripts/prepare-models.py first'); }
  if (manifest.schema !== 1 || !manifest.pairs || typeof manifest.pairs !== 'object') fail('unsupported manifest schema');
  const worker = join(root, 'public/local-translation.worker.js');
  if (!(await stat(worker).catch(() => null))?.isFile()) fail('worker bundle missing; npm run ai:build');
  const wasmDir = join(root, 'public/vendor/onnx');
  const wasm = (await readdir(wasmDir).catch(() => [])).filter(name => name.endsWith('.wasm'));
  if (!wasm.length) fail('ONNX runtime WASM binaries missing; npm run ai:build');
  const report = [];
  for (const [pair, entry] of Object.entries(manifest.pairs)) {
    if (!Object.hasOwn(allowedRepos, pair) || allowedRepos[pair] !== entry.repo) fail(`unexpected repository for ${pair}`);
    if (!/^[a-f0-9]{40}$/.test(entry.revision || '')) fail(`missing pinned SHA revision: ${pair}`);
    if (typeof entry.license !== 'string' || !entry.license) fail(`license not recorded: ${pair}`);
    if (!entry.sha256 || typeof entry.sha256 !== 'object') fail(`empty checksums: ${pair}`);
    const directory = resolve(models, entry.repo);
    if (!inside(models, directory)) fail('path traversal in model repository');
    let total = 0, count = 0, hasOnnx = false;
    for (const [relative, expected] of Object.entries(entry.sha256)) {
      if (typeof expected !== 'string' || !/^[a-f0-9]{64}$/.test(expected)) fail(`invalid hash ${pair}/${relative}`);
      const file = resolve(directory, relative);
      if (!inside(directory, file)) fail(`model asset path traversal: ${relative}`);
      const info = await stat(file).catch(() => null);
      if (!info?.isFile()) fail(`missing ${pair}/${relative}`);
      const actual = await sha256(file);
      if (actual !== expected) fail(`checksum mismatch ${pair}/${relative}`);
      if (relative.startsWith('onnx/') && relative.endsWith('_quantized.onnx')) hasOnnx = true;
      total += info.size; count++;
    }
    if (!hasOnnx) fail(`ONNX weights missing for ${pair}`);
    report.push({pair,files:count,megabytes:Math.round(total/1048576),license:entry.license,revision:entry.revision.slice(0,12)});
  }
  if (!report.length) fail('no models provisioned');
  return report;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  verify().then(rows => { console.table(rows); console.log('All listed assets verified. This does NOT test model inference or translation quality.'); })
    .catch(error => { console.error(error.message); process.exitCode = 1; });
}
export { verify };
