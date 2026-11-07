import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { generateKeyPairSync, verify } from 'node:crypto';
import { canUsePush, decodeVapidPublicKey, subscribeRoomPush, unsubscribeRoomPush } from '../public/push-client.js';
const sourcePath = new URL('../public/push-service.php', import.meta.url).pathname;

function php(code, env = {}) {
  const r = spawnSync('php', ['-r', `require ${JSON.stringify(sourcePath)}; ${code}`],
    { encoding: 'utf8', env: { ...process.env, ...env }, timeout: 5000 });
  if (r.status !== 0) throw new Error(r.stderr);
  return r.stdout;
}

test('Web Push endpoint restrictions reject local networks, redirects and unsupported vendors', () => {
  const cases = [
    ['https://fcm.googleapis.com/fcm/send/' + 'x'.repeat(80), true],
    ['https://updates.push.services.mozilla.com/wpush/v2/' + 'x'.repeat(80), true],
    ['https://web.push.apple.com/' + 'x'.repeat(80), true],
    ['http://127.0.0.1/' + 'a'.repeat(80), false],
    ['https://127.0.0.1/' + 'a'.repeat(80), false],
    ['https://fcm.googleapis.com.evil.example/' + 'a'.repeat(80), false],
    ['https://user:pass@fcm.googleapis.com/' + 'a'.repeat(80), false],
    ['https://fcm.googleapis.com:8080/' + 'a'.repeat(80), false],
    ['https://example.com/' + 'a'.repeat(80), false],
  ];
  for (const [endpoint, valid] of cases) {
    assert.equal(php(`echo pushEndpointAllowed(${JSON.stringify(endpoint)}) ? '1':'0';`), valid ? '1' : '0', endpoint);
  }
});

test('VAPID ES256 signature verifies and JWT contains correct audience, subject and expiry', () => {
  const temporary = mkdtempSync(join(tmpdir(), 'koncha-vapid-'));
  try {
    const { privateKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1',
      privateKeyEncoding: { type: 'sec1', format: 'pem' }, publicKeyEncoding: { type: 'spki', format: 'pem' } });
    const file = join(temporary, 'private.pem'); writeFileSync(file, privateKey, { mode: 0o600 });
    const endpoint = 'https://web.push.apple.com/' + 'v'.repeat(80);
    const output = JSON.parse(php(`$key = pushPrivateKey(); echo json_encode(['pub' => pushPublicKey($key),'token' => pushVapidJwt($key, ${JSON.stringify(endpoint)}, 'mailto:hello@example.org', 1700000000)]);`,
      { KONCHA_VAPID_PRIVATE_KEY_FILE: file }));
    assert.equal(decodeVapidPublicKey(output.pub).length, 65);
    const [head, claims, sig] = output.token.split('.');
    assert.equal(JSON.parse(Buffer.from(head, 'base64url').toString()).alg, 'ES256');
    const payload = JSON.parse(Buffer.from(claims, 'base64url').toString());
    assert.deepEqual(payload, { aud:'https://web.push.apple.com', exp:1700003600, sub:'mailto:hello@example.org' });
    assert.equal(verify('sha256', Buffer.from(`${head}.${claims}`),
      { key: privateKey, dsaEncoding: 'ieee-p1363' }, Buffer.from(sig, 'base64url')), true);
    assert.equal(output.token.includes('PRIVATE KEY'), false);
  } finally { rmSync(temporary, { recursive:true, force:true }); }
});

test('Push client needs explicit permission and sends only endpoint plus opaque device id', async () => {
  let requests = [], prompted = 0;
  const endpoint = 'https://web.push.apple.com/' + 'q'.repeat(80);
  const encoded = Buffer.concat([Buffer.from([4]),Buffer.alloc(64,7)]).toString('base64url');
  const subscription = { endpoint };
  const env = { isSecureContext:true, PushManager:function(){},
    Notification:{ permission:'default',requestPermission() { prompted++; return Promise.resolve('granted'); } },
    navigator:{ serviceWorker:{ ready:Promise.resolve({ pushManager:{
      getSubscription:async()=>null,
      subscribe:async ({applicationServerKey})=>{assert.equal(applicationServerKey.length,65);return subscription;}
    }}) } } };
  const api = async (action, opts) => { requests.push({action,body:opts.body});
    return action === 'push_config' ? {enabled:true,publicKey:encoded} : {ok:true}; };
  assert.equal(canUsePush(env), true);
  await subscribeRoomPush({api,room:{presenceId:'Q'.repeat(16)},keys:{authToken:'private'},env});
  assert.equal(prompted,1);
  assert.deepEqual(requests.map(x=>x.action),['push_config','push_subscribe']);
  assert.deepEqual(requests[1].body, { deviceId:'Q'.repeat(16),endpoint });
  assert.equal(JSON.stringify(requests).includes('private'), false);
});

test('Push is unavailable without a secure context and never silently grants permission', async () => {
  assert.equal(canUsePush({isSecureContext:false,navigator:{},PushManager:function(){}}),false);
  await assert.rejects(subscribeRoomPush({api:async()=>{},room:{presenceId:'1'.repeat(16)},keys:{},env:{}}), /unavailable/);
});

test('Push worker notification never includes untrusted payload fields', async () => {
  const { runInNewContext } = await import('node:vm');
  const source = readFileSync(new URL('../public/sw.js', import.meta.url), 'utf8');
  const listeners = {};
  const notices = [];
  const self={location:{origin:'https://chat.example'},registration:{showNotification:async (...args)=>notices.push(args)},
    addEventListener:(event,handler)=>listeners[event]=handler};
  runInNewContext(source, {self, URL, caches:{}});
  let wait = Promise.resolve();
  listeners.push({data:{sender:'Private Person',body:'SECRET',roomId:'SENSITIVE'},
    waitUntil:(promise)=>{wait=promise;}});
  await wait;
  assert.equal(notices.length,1);
  assert.equal(JSON.stringify(notices).includes('Private Person'), false);
  assert.equal(JSON.stringify(notices).includes('SECRET'), false);
  assert.equal(JSON.stringify(notices).includes('SENSITIVE'), false);
});
