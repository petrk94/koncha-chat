// Koncha v0.1 experiment. Not production-grade E2EE. See docs/SECURITY.md.
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
export function parseInvite(hash) {
  const match = /^#join=([A-Za-z0-9_-]{24})\.([A-Za-z0-9_-]{43})$/.exec(hash);
  if (!match) return null;
  if (b64uDecode(match[1]).length !== 18 || b64uDecode(match[2]).length !== 32) return null;
  return { roomId: match[1], secret: match[2] };
}
export function inviteUrl(base, room) {
  const url = new URL(base);
  url.hash = `join=${room.roomId}.${room.secret}`;
  return url.href;
}
export async function deriveRoomKeys(room) {
  const raw = b64uDecode(room.secret);
  const salt = b64uDecode(room.roomId);
  if (raw.length !== 32 || salt.length !== 18) throw new Error('Invalid invitation');
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
