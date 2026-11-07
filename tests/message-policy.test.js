import test from 'node:test';
import assert from 'node:assert/strict';
import { createRoom, randomId } from '../public/crypto.js';
import { generateDeviceKeyPair, exportDevicePublicKey, signChatPayload } from '../public/identity.js';
import { authenticateRoomMessage } from '../public/message-policy.js';

test('new conversations reject unsigned downgrade even when ciphertext decrypts', async () => {
  const room = { ...createRoom(), requireSignatures: true };
  const identity = { id: 'mine', publicKey: null };
  await assert.rejects(authenticateRoomMessage(room, { senderId:'peer', text:'forged' }, identity), /unsigned_message_rejected/);
  await assert.rejects(authenticateRoomMessage(room, { senderId:'peer', text:'forged' }, identity, {fromLocalCache:true}), /unsigned_message_rejected/);
});

test('pinned remote key rejects substitution but accepts authentic signatures', async () => {
  const a = await generateDeviceKeyPair(), b = await generateDeviceKeyPair();
  const room = { ...createRoom(), requireSignatures:true, peer:{publicKey:await exportDevicePublicKey(a)} };
  const self = {id:'self', publicKey:await exportDevicePublicKey(b)};
  const payload = { text:'こんにちは', senderId:'peer', sender:'Alex', ts:Date.now(), nonce:randomId(16) };
  const authentic = await signChatPayload(a,room.roomId,payload);
  const imposter = await signChatPayload(b,room.roomId,payload);
  assert.equal((await authenticateRoomMessage(room, authentic, self)).legacyUnsigned, false);
  await assert.rejects(authenticateRoomMessage(room, imposter, self), /device_signature_invalid/);
  await assert.rejects(authenticateRoomMessage(room, {...authentic,text:'changed'}, self), /device_signature_invalid/);
});

test('old unsigned room messages are only eligible as unverified cached history after key pin', async () => {
  const a = await generateDeviceKeyPair();
  const room = { ...createRoom(), peer:{publicKey:await exportDevicePublicKey(a)} };
  const identity = {id:'self'};
  const message = {senderId:'peer',text:'old local message'};
  assert.equal((await authenticateRoomMessage(room,message,identity,{fromLocalCache:true})).legacyUnsigned,true);
  await assert.rejects(authenticateRoomMessage(room,message,identity),/unsigned_message_rejected/);
});
