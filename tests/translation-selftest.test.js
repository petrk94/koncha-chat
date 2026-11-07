import test from 'node:test';
import assert from 'node:assert/strict';
import { runTranslationSelfTest, PUBLIC_TRANSLATION_SAMPLES } from '../public/translation-selftest.js';

test('translation self-test executes one dummy sentence locally and disposes resources', async () => {
  const calls=[];
  const createSession=async ({status}) => {
    status('Loading local model');
    calls.push('create');
    return {
      async prepare(from,to) { calls.push('prepare:'+from+'-'+to); },
      async translate(text,from,to) {
        assert.equal(text, PUBLIC_TRANSLATION_SAMPLES.ja);
        calls.push('translate:'+from+'-'+to);
        return 'Good morning. How are you?';
      },
      dispose(){calls.push('dispose');}
    };
  };
  const result=await runTranslationSelfTest({from:'ja',to:'en',createSession,now:(()=>{let n=0;return ()=>n+=10;})()});
  assert.equal(result.output,'Good morning. How are you?');
  assert.equal(result.elapsedMs,10);
  assert.deepEqual(calls,['create','prepare:ja-en','translate:ja-en','dispose']);
});
test('self-test never accepts invalid source/target or calls a model silently', async () => {
  let called=false;
  await assert.rejects(runTranslationSelfTest({from:'ja',to:'ja',createSession:()=>{called=true;}}));
  assert.equal(called,false);
});
test('self-test fails closed and disposes session when inference fails', async () => {
  let disposed=false;
  await assert.rejects(runTranslationSelfTest({from:'de',to:'ja',
    createSession:async()=>({prepare:async()=>{},translate:async()=>'',dispose(){disposed=true;}})}),/invalid translation/);
  assert.equal(disposed,true);
});
