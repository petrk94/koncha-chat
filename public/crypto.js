// Koncha experiment. Not audited identity-authenticated E2EE. See docs/SECURITY.md.
const enc = new TextEncoder();
const dec = new TextDecoder();
const cryptoApi = globalThis.crypto;

export function b64uEncode(input) {
  return btoa(String.fromCharCode(...input)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}
export function b64uDecode(input) {
  if (!/^[A-Za-z0-9_-]+$/.test(input)) throw new Error('Invalid encoding');
  const s = input.replace(/-/g, '+').replace(/_/g, '/');
  const str = atob(s + '='.repeat((4 - s.length % 4) % 4));
  return Uint8Array.from(str, x => x.charCodeAt(0));
}
export function randomId(length = 18) {
  const bytes = new Uint8Array(length);
  cryptoApi.getRandomValues(bytes);
  return b64uEncode(bytes);
}
export function createRoom() {
  return { roomId: randomId(18), secret: randomId(32) };
}
// Legacy #join links are intentionally no longer accepted: they granted permanent access.
export function parseInvite(hash) {
  const match = /^#invite=([A-Za-z0-9_-]{24})\.([A-Za-z0-9_-]{22})\.([A-Za-z0-9_-]{43})$/.exec(hash);
  if (!match) return null;
  if (b64uDecode(match[1]).length !== 18 || b64uDecode(match[2]).length !== 16 || b64uDecode(match[3]).length !== 32) return null;
  return { roomId: match[1], inviteId: match[2], token: match[3] };
}
export function createInvite(room) {
  if (!room?.roomId || !room?.secret) throw new Error('Invalid room');
  return { roomId: room.roomId, inviteId: randomId(16), token: randomId(32) };
}
export function inviteUrl(base, invite) {
  const url = new URL(base);
  url.hash = `invite=${invite.roomId}.${invite.inviteId}.${invite.token}`;
  return url.href;
}
export async function tokenVerifier(token) {
  const bytes = b64uDecode(token);
  if (bytes.length !== 32) throw new Error('Invalid invitation token');
  return b64uEncode(new Uint8Array(await cryptoApi.subtle.digest('SHA-256', bytes)));
}
async function inviteKey(invite) {
  const raw = b64uDecode(invite.token);
  const salt = b64uDecode(invite.roomId);
  if (raw.length !== 32 || salt.length !== 18) throw new Error('Invalid invitation');
  const master = await cryptoApi.subtle.importKey('raw', raw, 'HKDF', false, ['deriveKey']);
  return cryptoApi.subtle.deriveKey(
    { name: 'HKDF', hash: 'SHA-256', salt, info: enc.encode(`Koncha/v2/invite/${invite.inviteId}`) }, master,
    { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}
export async function sealInvite(invite, room) {
  if (invite.roomId !== room.roomId) throw new Error('Wrong room');
  const iv = cryptoApi.getRandomValues(new Uint8Array(12));
  const key = await inviteKey(invite);
  const ciphertext = await cryptoApi.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(JSON.stringify({ roomId: room.roomId, secret: room.secret })));
  return { iv: b64uEncode(iv), ciphertext: b64uEncode(new Uint8Array(ciphertext)) };
}
export async function unsealInvite(invite, payload) {
  const iv = b64uDecode(payload?.iv || '');
  if (iv.length !== 12) throw new Error('Invalid invite IV');
  const key = await inviteKey(invite);
  const decrypted = await cryptoApi.subtle.decrypt({ name: 'AES-GCM', iv }, key, b64uDecode(payload.ciphertext));
  const room = JSON.parse(dec.decode(decrypted));
  if (room.roomId !== invite.roomId || b64uDecode(room.secret).length !== 32) throw new Error('Invalid invite payload');
  return room;
}
export async function deriveRoomKeys(room) {
  const raw = b64uDecode(room.secret);
  const salt = b64uDecode(room.roomId);
  if (raw.length !== 32 || salt.length !== 18) throw new Error('Invalid room');
  const key = await cryptoApi.subtle.importKey('raw', raw, 'HKDF', false, ['deriveKey', 'deriveBits']);
  const shared = { name: 'HKDF', hash: 'SHA-256', salt };
  const messageKey = await cryptoApi.subtle.deriveKey(
    { ...shared, info: enc.encode('Koncha/v1/AES-GCM/message') }, key,
    { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  const authBits = await cryptoApi.subtle.deriveBits(
    { ...shared, info: enc.encode('Koncha/v1/relay/auth') }, key, 256);
  return { messageKey, authToken: b64uEncode(new Uint8Array(authBits)) };
}
export async function encryptPayload(messageKey, payload) {
  const iv = cryptoApi.getRandomValues(new Uint8Array(12));
  const raw = enc.encode(JSON.stringify(payload));
  if (raw.length > 6000) throw new Error('Message is too long');
  const ciphertext = await cryptoApi.subtle.encrypt({ name: 'AES-GCM', iv }, messageKey, raw);
  return { v: 1, id: cryptoApi.randomUUID(), iv: b64uEncode(iv), ciphertext: b64uEncode(new Uint8Array(ciphertext)) };
}
export async function decryptPayload(messageKey, envelope) {
  if (envelope?.v !== 1 || typeof envelope?.iv !== 'string' || typeof envelope?.ciphertext !== 'string') throw new Error('Unsupported message envelope');
  const iv = b64uDecode(envelope.iv);
  if (iv.length !== 12) throw new Error('Invalid IV');
  const raw = await cryptoApi.subtle.decrypt({ name: 'AES-GCM', iv }, messageKey, b64uDecode(envelope.ciphertext));
  const value = JSON.parse(dec.decode(raw));
  if (!value || typeof value.text !== 'string' || typeof value.sender !== 'string' || typeof value.senderId !== 'string' || typeof value.ts !== 'number') throw new Error('Malformed message');
  return value;
}
