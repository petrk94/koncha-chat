import test from 'node:test';
import assert from 'node:assert/strict';
import { createRoom, parseInvite, inviteUrl, deriveRoomKeys, encryptPayload, decryptPayload } from '../public/crypto.js';
import { romanizeKana } from '../public/romanize.js';

test('generated rooms are distinct, correctly encoded and shareable', () => {
  const a = createRoom(); const b = createRoom();
  assert.notEqual(a.roomId, b.roomId);
  assert.notEqual(a.secret, b.secret);
  assert.deepEqual(parseInvite(new URL(inviteUrl('https://example.org/', a)).hash), a);
  assert.equal(parseInvite('#join=broken'), null);
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
  const a = await deriveRoomKeys(createRoom());
  const b = await deriveRoomKeys(createRoom());
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
