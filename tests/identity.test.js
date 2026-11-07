import test from 'node:test';
import assert from 'node:assert/strict';
import { createRoom, createInvite, sealInvite, unsealInvite, parseInvite, inviteUrl, randomId } from '../public/crypto.js';
import { generateDeviceKeyPair, exportDevicePublicKey, deviceFingerprint, signChatPayload, verifyChatPayload } from '../public/identity.js';

test('P-256 browser device keys sign a room-bound message and reject tampering', async () => {
  const pair = await generateDeviceKeyPair();
  const otherPair = await generateDeviceKeyPair();
  assert.equal(pair.privateKey.extractable, false);
  const room = createRoom();
  const original = { senderId: 'local-device', sender: 'Yuki', senderHandle: 'yuki.t', text: 'こんばんは', ts: Date.now(), nonce: randomId(16), presenceId: randomId(12) };
  const signed = await signChatPayload(pair, room.roomId, original);
  assert.equal(await verifyChatPayload(room.roomId, signed), true);
  assert.equal(await verifyChatPayload(room.roomId, signed, await exportDevicePublicKey(pair)), true);
  assert.equal(await verifyChatPayload(room.roomId, signed, await exportDevicePublicKey(otherPair)), false);
  assert.equal(await verifyChatPayload(createRoom().roomId, signed), false);
  assert.equal(await verifyChatPayload(room.roomId, { ...signed, text: 'ATTACK' }), false);
  assert.equal(await verifyChatPayload(room.roomId, { ...signed, presenceId: randomId(12) }), false);
  assert.equal(await verifyChatPayload(room.roomId, { ...signed, senderId: 'impostor' }), false);
  assert.equal(await verifyChatPayload(room.roomId, { ...signed, nonce: '0'.repeat(22) }), false);
  const code = await deviceFingerprint(signed.publicKey);
  assert.equal(code, await deviceFingerprint(await exportDevicePublicKey(pair)));
  assert.match(code, /^[A-Z2-7]{4}(-[A-Z2-7]{4}){12}$/);
  assert.notEqual(code, await deviceFingerprint(await exportDevicePublicKey(otherPair)));
});

test('invite handoff pins inviters public key and opt-in room-specific presence ID', async () => {
  const pair = await generateDeviceKeyPair();
  const room = { ...createRoom(), requireSignatures: true, presenceId: randomId(12) };
  const invite = createInvite(room, { alias: 'Petr', handle: 'petr.chan', publicKey: await exportDevicePublicKey(pair) });
  const link = inviteUrl('https://example.test/', invite);
  assert.equal(link.includes('presenceId'), false);
  assert.equal(link.includes('publicKey'), false);
  assert.equal(link.includes(room.secret), false);
  const joined = await unsealInvite(parseInvite(new URL(link).hash), await sealInvite(invite, room));
  assert.deepEqual(joined.peer.publicKey, await exportDevicePublicKey(pair));
  assert.equal(joined.peer.presenceId, room.presenceId);
  assert.equal(joined.requireSignatures, true);
});

test('a 2000-character Japanese message with signature fits the encrypted relay envelope', async () => {
  const { deriveRoomKeys, encryptPayload } = await import('../public/crypto.js');
  const pair = await generateDeviceKeyPair();
  const room = createRoom();
  const signed = await signChatPayload(pair, room.roomId, {senderId:'device',sender:'Yuki',senderHandle:'yuki.t',ts:Date.now(),nonce:randomId(16),presenceId:randomId(12),text:'あ'.repeat(2000)});
  const env = await encryptPayload((await deriveRoomKeys(room)).messageKey, signed);
  assert.ok(env.ciphertext.length <= 11000);
});
