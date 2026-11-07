/** Build self-hosted browser AI runtime. Requires `npm install` on the developer machine. */
import { build } from 'esbuild';
import { mkdir, readdir, copyFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
const root = new URL('../', import.meta.url);
const outdir = new URL('../public/vendor/onnx/', import.meta.url);
await build({
  entryPoints: [new URL('../src/local-translation.worker.js', import.meta.url).pathname],
  outfile: new URL('../public/local-translation.worker.js', import.meta.url).pathname,
  bundle: true, format: 'esm', platform: 'browser', target: ['es2022'],
  define: { 'process.env.NODE_ENV': '"production"' },
});
await mkdir(outdir, { recursive: true });
const source = new URL('../node_modules/onnxruntime-web/dist/', import.meta.url).pathname;
const files = (await readdir(source)).filter(f => f.endsWith('.wasm'));
if (!files.length) throw new Error('ONNX WASM assets missing. Run npm install before building.');
await Promise.all(files.map(name => copyFile(join(source, name), join(outdir.pathname, name))));
await writeFile(new URL('../public/vendor/onnx/README.txt', import.meta.url), 'ONNX Runtime assets: installed from the pinned package in package-lock.json.\n');
console.log(`Built local worker and staged ${files.length} WASM files. Models must be provisioned separately under public/models/.`);
