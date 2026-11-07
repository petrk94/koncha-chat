import test from 'node:test';
import assert from 'node:assert/strict';
import { AttentionController, badgeFavicon, badgeText } from '../public/notifications.js';

test('favicon counts never include message or sender text', () => {
  assert.equal(badgeText(0), '');
  assert.equal(badgeText(5), '5');
  assert.equal(badgeText(123), '99+');
  assert.match(badgeFavicon(10), />10<\/text>/);
  assert.doesNotMatch(badgeFavicon(10), /sender|hello|message/i);
});

function setup({hidden=true} = {}) {
  const icon = { href: '/icon.svg', setAttribute(_key, val) { this.href = val; }, getAttribute() { return this.href; } };
  const listeners = {};
  const doc = { hidden, title:'Koncha', querySelector:() => icon, addEventListener:(event,cb)=>{listeners[event] = cb;} };
  const count = { set: [], clear: 0 };
  let timerId = 0;
  const win = { setInterval:()=>++timerId, clearInterval:()=>{timerId = 0}, isSecureContext: true };
  const nav = {
    setAppBadge: value => { count.set.push(value); },
    clearAppBadge: () => { count.clear++; }
  };
  return { attention:new AttentionController({doc,nav,win}), doc, icon, listeners, count };
}

test('only unread remote messages arriving while hidden increase badge', async () => {
  const v=setup();
  v.attention.incoming(2);
  assert.equal(v.attention.count, 2);
  assert.equal(v.doc.title, '(2) Koncha');
  assert.ok(v.icon.href.startsWith('data:image/svg+xml,'));
  v.attention.incoming(1);
  assert.equal(v.attention.count,3);
  v.doc.hidden=false;
  v.listeners.visibilitychange();
  assert.equal(v.attention.count, 0);
  assert.equal(v.icon.href, '/icon.svg');
  assert.equal(v.doc.title,'Koncha');
  v.attention.incoming(4);
  assert.equal(v.attention.count, 0, 'No unread badge while chat is visible');
  await Promise.resolve();
  assert.deepEqual(v.count.set, [2, 3]);
  assert.ok(v.count.clear > 0);
});

test('OS notifications are privacy-preserving and require explicit permission', async () => {
  const v=setup();
  const words=[];
  v.attention.win.Notification = { permission:'granted' };
  v.attention.nav.serviceWorker = { register:async url=>({showNotification:async (title,options)=>words.push({title,options,url})}) };
  v.attention.labels = ()=>({title:'Neue Koncha-Nachricht',body:'Öffne Koncha.'});
  v.attention.incoming(1);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(words.length,1);
  assert.equal(words[0].title,'Neue Koncha-Nachricht');
  assert.equal(words[0].options.body,'Öffne Koncha.');
  assert.equal(words[0].options.tag,'koncha-unread');
  assert.equal(words[0].options.data.url,'/?resume=1');
  assert.ok(!JSON.stringify(words[0]).includes('sender'));
});

test('system permission request is only invoked by explicit method', async () => {
  const v=setup();
  let called=0;
  v.attention.win.Notification={permission:'default',requestPermission:()=>{called++;return Promise.resolve('denied');}};
  v.attention.incoming(1);
  assert.equal(called,0);
  assert.equal(await v.attention.requestPermission(),'denied');
  assert.equal(called,1);
});
