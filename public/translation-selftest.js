/**
 * Explicit, user-triggered translation inference smoke test. Never uses real
 * messages, never calls a translation API, never runs silently on startup.
 * A successful result proves execution, NOT accuracy or model provenance.
 */
export const PUBLIC_TRANSLATION_SAMPLES = Object.freeze({
  de: 'Guten Morgen. Wie geht es dir heute?',
  en: 'Good morning. How are you today?',
  ja: 'おはようございます。今日はお元気ですか。'
});

export async function runTranslationSelfTest({
  from, to, createSession, onProgress = () => {},
  now = () => Date.now()
}) {
  if (!Object.hasOwn(PUBLIC_TRANSLATION_SAMPLES, from) ||
      !Object.hasOwn(PUBLIC_TRANSLATION_SAMPLES, to) || from === to) {
    throw new Error('Unsupported translation test language pair');
  }
  if (typeof createSession !== 'function') throw new Error('Missing local translation session');
  const input = PUBLIC_TRANSLATION_SAMPLES[from]; // Never a private chat message.
  const start = now();
  let session;
  try {
    session = await createSession({status:onProgress});
    await session.prepare(from, to);
    const output = await session.translate(input, from, to);
    if (typeof output !== 'string' || !output.trim() || output.length > 5000) {
      throw new Error('Local model returned an invalid translation');
    }
    return {from, to, input, output:output.trim(), elapsedMs:Math.max(0, now()-start)};
  } finally {
    session?.dispose?.();
  }
}
