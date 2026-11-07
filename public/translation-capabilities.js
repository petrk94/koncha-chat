/** Feature probe only. No model runtime is bundled for Safari/Firefox yet. */
export async function translationCapabilities(environment = globalThis) {
  const native = typeof environment.Translator?.availability === 'function' && typeof environment.Translator?.create === 'function';
  let webGPU = false;
  try { webGPU = Boolean(await environment.navigator?.gpu?.requestAdapter?.()); } catch { /* No GPU adapter available. */ }
  return { native, webGPU, wasm: typeof environment.WebAssembly !== 'undefined', localModelBundled: false };
}
