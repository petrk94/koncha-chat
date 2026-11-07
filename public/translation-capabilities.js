/** Capability probing; a browser with WASM support is NOT automatically model-ready. */
export async function translationCapabilities(environment = globalThis) {
  const native = typeof environment.Translator?.availability === 'function' && typeof environment.Translator?.create === 'function';
  let webGPU = false;
  try { webGPU = Boolean(await environment.navigator?.gpu?.requestAdapter?.()); } catch {}
  const wasm = typeof environment.WebAssembly !== 'undefined';
  let localModelBundled = false;
  let installedPairs = [];
  // A generated local manifest is produced only after preparing actual model files.
  // We do not send chat text during capability probing.
  if (typeof environment.fetch === 'function' && environment.location?.origin) {
    try {
      const result = await environment.fetch(new URL('/models/manifest.json', environment.location.origin), { cache: 'no-store', credentials: 'omit' });
      if (result.ok) {
        const manifest = await result.json();
        if (manifest.schema === 1 && manifest.pairs && typeof manifest.pairs === 'object') {
          installedPairs = Object.keys(manifest.pairs).filter(p => /^(ja|en|de)-(ja|en|de)$/.test(p));
          localModelBundled = installedPairs.length > 0;
          if (localModelBundled) {
            const worker = await environment.fetch(new URL('/local-translation.worker.js', environment.location.origin), {method:'HEAD', cache:'no-store', credentials:'omit'});
            localModelBundled = worker.ok;
          }
        }
      }
    } catch {} // No local model available.
  }
  return { native, webGPU, wasm, localModelBundled, installedPairs };
}
