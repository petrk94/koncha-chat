import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createRoom, createInvite, parseInvite, inviteUrl, tokenVerifier, sealInvite, unsealInvite,
  deriveRoomKeys, encryptPayload, decryptPayload
} from '../public/crypto.js';
import { romanizeKana } from '../public/romanize.js';
import { translate, applyLanguage } from '../public/i18n.js';

test('rooms and one-time invite URLs are distinct; legacy perpetual invites are rejected', () => {
  const a = createRoom(), b = createRoom();
  assert.notEqual(a.roomId, b.roomId);
  assert.notEqual(a.secret, b.secret);
  const invite = createInvite(a);
  assert.deepEqual(parseInvite(new URL(inviteUrl('https://example.org/', invite)).hash), invite);
  assert.equal(parseInvite(`#join=${a.roomId}.${a.secret}`), null);
  assert.equal(parseInvite('#invite=broken'), null);
  assert.notEqual(createInvite(a).token, invite.token);
  assert.equal(inviteUrl('https://example.org/', invite).includes(a.secret), false);
});

test('invite transfers room secret in authenticated ciphertext, not in URL or relay payload', async () => {
  const room = createRoom(), invite = createInvite(room);
  const payload = await sealInvite(invite, room);
  assert.equal(JSON.stringify(payload).includes(room.secret), false);
  assert.deepEqual(await unsealInvite(invite, payload), room);
  assert.equal((await tokenVerifier(invite.token)).length, 43);
  await assert.rejects(unsealInvite(createInvite(room), payload));
});

test('same room secret decrypts authentic ciphertext', async () => {
  const room = createRoom();
  const sender = await deriveRoomKeys(room);
  const receiver = await deriveRoomKeys(room);
  assert.equal(sender.authToken, receiver.authToken);
  const text = { text: 'こんにちは Hello!', sender: 'Yuki', senderId: 'device1', ts: 1794000000000 };
  const envelope = await encryptPayload(sender.messageKey, text);
  assert.deepEqual(await decryptPayload(receiver.messageKey, envelope), text);
  assert.equal(JSON.stringify(envelope).includes('こんにちは'), false);
  assert.equal(JSON.stringify(envelope).includes('Yuki'), false);
});

test('tampering or a different room secret fails authentication', async () => {
  const a = await deriveRoomKeys(createRoom()), b = await deriveRoomKeys(createRoom());
  const env = await encryptPayload(a.messageKey, { text: 'secret', sender: 'A', senderId: 'id', ts: 123 });
  await assert.rejects(decryptPayload(b.messageKey, env));
  env.ciphertext = env.ciphertext.slice(0, -2) + 'AB';
  await assert.rejects(decryptPayload(a.messageKey, env));
});

test('readable kana aid handles kana, digraphs and sokuon', () => {
  assert.equal(romanizeKana('こんにちは'), 'konnichiha');
  assert.equal(romanizeKana('きょう'), 'kyou');
  assert.equal(romanizeKana('チャット'), 'chatto');
  assert.equal(romanizeKana('Hello!'), 'Hello!');
});

test('UI strings exist for de, en and ja and retain a fallback', () => {
  for (const language of ['de', 'en', 'ja']) {
    assert.notEqual(translate('onboardTitle', language), 'onboardTitle');
    assert.notEqual(translate('inviteExpired', language), 'inviteExpired');
  }
  assert.equal(translate('unknownTranslationKey', 'ja'), 'unknownTranslationKey');
});
