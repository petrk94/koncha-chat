import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { pwaFeatureReport, formatPwaReport } from '../public/pwa-diagnostics.js';

test('PWA device report does not confuse installed mode with push availability', () => {
  const env={ isSecureContext:true, navigator:{ onLine:false, serviceWorker:{}, standalone:true }, WebAssembly, indexedDB:{},
    Notification:{ permission:'denied' }, window:{matchMedia(){return {matches:false};}} };
  const result=pwaFeatureReport(env);
  assert.equal(result.standalone,true);
  assert.equal(result.online,false);
  assert.equal(result.push,false);
  assert.match(formatPwaReport(result, 'de'), /Web Push API: –/);
});

test('service worker never intercepts room API or model downloads', () => {
  const listeners={};
  const self={ location:{origin:'https://chat.example'}, addEventListener:(name, cb)=>{listeners[name]=cb;} };
  const source=readFileSync(new URL('../public/sw.js', import.meta.url),'utf8');
  runInNewContext(source,{self, URL, caches:{}});
  let intercepted=false;
  const dispatch=url=>listeners.fetch({request:{method:'GET',url},respondWith(){intercepted=true;}});
  dispatch('https://chat.example/api.php?action=list&room=PRIVATE');
  assert.equal(intercepted,false);
  dispatch('https://chat.example/models/Xenova/opus-mt-ja-en/config.json');
  assert.equal(intercepted,false);
  dispatch('https://other.example/app.js');
  assert.equal(intercepted,false);
});
