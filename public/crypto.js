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
// The fragment is not sent in HTTP requests. Names in links are self-declared,
// not verified identities. The encrypted handoff binds the preview to the claim.
export function parseInvite(hash) {
  if (!hash.startsWith('#invite=')) return null;
  const params = new URLSearchParams(hash.slice(1));
  if (params.getAll('invite').length !== 1 || params.getAll('from').length > 1 || params.getAll('handle').length > 1 || [...params.keys()].some(k => !['invite', 'from', 'handle'].includes(k))) return null;
  const match = /^([A-Za-z0-9_-]{24})\.([A-Za-z0-9_-]{22})\.([A-Za-z0-9_-]{43})$/.exec(params.get('invite') || '');
  if (!match) return null;
  if (b64uDecode(match[1]).length !== 18 || b64uDecode(match[2]).length !== 16 || b64uDecode(match[3]).length !== 32) return null;
  const sender = params.get('from') || '';
  const handle = params.get('handle') || '';
  if (sender.length > 32 || handle.length > 24 || /[\u0000-\u001f\u007f]/.test(sender) || (handle && !/^[a-z][a-z0-9._-]{2,23}$/.test(handle))) return null;
  return { roomId: match[1], inviteId: match[2], token: match[3], sender, handle };
}
export function createInvite(room, identity = null) {
  if (!room?.roomId || !room?.secret) throw new Error('Invalid room');
  return { roomId: room.roomId, inviteId: randomId(16), token: randomId(32),
    sender: String(identity?.alias || '').slice(0, 32), handle: String(identity?.handle || '').slice(0, 24), publicKey: identity?.publicKey || null, presenceId: room.presenceId || '' };
}
export function inviteUrl(base, invite) {
  const url = new URL(base);
  const params = new URLSearchParams();
  params.set('invite', `${invite.roomId}.${invite.inviteId}.${invite.token}`);
  if (invite.sender) params.set('from', invite.sender);
  if (invite.handle) params.set('handle', invite.handle);
  url.hash = params.toString();
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
  const ciphertext = await cryptoApi.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(JSON.stringify({ roomId: room.roomId, secret: room.secret, sender: invite.sender || '', handle: invite.handle || '', publicKey: invite.publicKey || null, presenceId: invite.presenceId || '', requireSignatures: room.requireSignatures === true })));
  return { iv: b64uEncode(iv), ciphertext: b64uEncode(new Uint8Array(ciphertext)) };
}
export async function unsealInvite(invite, payload) {
  const iv = b64uDecode(payload?.iv || '');
  if (iv.length !== 12) throw new Error('Invalid invite IV');
  const key = await inviteKey(invite);
  const decrypted = await cryptoApi.subtle.decrypt({ name: 'AES-GCM', iv }, key, b64uDecode(payload.ciphertext));
  const room = JSON.parse(dec.decode(decrypted));
  if (room.roomId !== invite.roomId || b64uDecode(room.secret).length !== 32) throw new Error('Invalid invite payload');
  // A modified preview name must never silently become an accepted chat identity.
  if ((invite.sender || '') !== (room.sender || '') || (invite.handle || '') !== (room.handle || '')) throw new Error('invite_identity_mismatch');
  return room.sender ? { roomId: room.roomId, secret: room.secret, ...(room.requireSignatures ? { requireSignatures: true } : {}), peer: { alias: room.sender, handle: room.handle || '', publicKey: room.publicKey || null, presenceId: room.presenceId || '', verified: false } } : { roomId: room.roomId, secret: room.secret, ...(room.requireSignatures ? { requireSignatures: true } : {}) };
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
  if (raw.length > 7600) throw new Error('Message is too long');
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
