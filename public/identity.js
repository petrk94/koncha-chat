/**
 * Experimental per-browser signing identity (P-256 ECDSA / Web Crypto).
 * This authenticates a pinned device key, NOT a human, a recovered account,
 * or a fully reviewed E2EE session. No ratchet, no forward secrecy.
 */
import { b64uEncode, b64uDecode } from './crypto.js';
const enc = new TextEncoder();
const subtle = globalThis.crypto.subtle;
const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export async function generateDeviceKeyPair() {
  return subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign', 'verify']);
}
export async function exportDevicePublicKey(pair) {
  return subtle.exportKey('jwk', pair.publicKey);
}
export function validDevicePublicKey(key) {
  return !!key && key.kty === 'EC' && key.crv === 'P-256' &&
    typeof key.x === 'string' && typeof key.y === 'string' &&
    /^[A-Za-z0-9_-]{43}$/.test(key.x) && /^[A-Za-z0-9_-]{43}$/.test(key.y) &&
    (!key.key_ops || (Array.isArray(key.key_ops) && key.key_ops.every(op => op === 'verify')));
}
function fingerprintWords(bytes) {
  let bits = 0, value = 0, result = '';
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) { result += B32[(value >>> (bits -= 5)) & 31]; }
  }
  if (bits) result += B32[(value << (5 - bits)) & 31];
  return result.match(/.{1,4}/g).join('-');
}
export async function deviceFingerprint(publicKey) {
  if (!validDevicePublicKey(publicKey)) throw new Error('Invalid device key');
  const key = await subtle.importKey('jwk', publicKey, { name: 'ECDSA', namedCurve: 'P-256' }, true, ['verify']);
  const raw = await subtle.exportKey('raw', key);
  const digest = new Uint8Array(await subtle.digest('SHA-256', raw));
  // Full 256-bit fingerprint; grouping is for comparison out-of-band.
  return fingerprintWords(digest);
}
function signable(roomId, payload) {
  return enc.encode(JSON.stringify(['koncha/sign/v1', roomId, payload.senderId,
    payload.sender, payload.senderHandle || '', payload.ts, payload.nonce, payload.presenceId || '', payload.text]));
}
export async function signChatPayload(pair, roomId, payload) {
  const signature = await subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, pair.privateKey, signable(roomId, payload));
  return { ...payload, publicKey: await exportDevicePublicKey(pair), signature: b64uEncode(new Uint8Array(signature)) };
}
export async function verifyChatPayload(roomId, payload, pinnedKey = null) {
  if (!payload || !validDevicePublicKey(payload.publicKey) || !payload.signature ||
      typeof payload.senderId !== 'string' || typeof payload.text !== 'string' ||
      typeof payload.nonce !== 'string' || !/^[A-Za-z0-9_-]{16,64}$/.test(payload.nonce) ||
      !Number.isFinite(payload.ts)) return false;
  if (pinnedKey && (!validDevicePublicKey(pinnedKey) ||
    pinnedKey.x !== payload.publicKey.x || pinnedKey.y !== payload.publicKey.y)) return false;
  try {
    const key = await subtle.importKey('jwk', payload.publicKey,
      { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
    return subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, key,
      b64uDecode(payload.signature), signable(roomId, payload));
  } catch { return false; }
}
