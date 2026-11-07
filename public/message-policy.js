/** Reject sender-key substitution and signature downgrades for new conversations.
 * Legacy unsigned history can only be shown as unverified local cache data.
 */
import { verifyChatPayload } from './identity.js';
export async function authenticateRoomMessage(room, message, identity, { fromLocalCache = false } = {}) {
  if (!message.signature) {
    if (room.requireSignatures || (!fromLocalCache && room.peer?.publicKey)) {
      throw new Error('unsigned_message_rejected');
    }
    return { legacyUnsigned: true, mine: message.senderId === identity.id };
  }
  const mine = message.senderId === identity.id;
  const pinned = mine ? identity.publicKey : room.peer?.publicKey;
  if (!await verifyChatPayload(room.roomId, message, pinned || null)) throw new Error('device_signature_invalid');
  if (mine && (!identity.publicKey || identity.publicKey.x !== message.publicKey.x || identity.publicKey.y !== message.publicKey.y)) {
    throw new Error('own_device_key_mismatch');
  }
  return { legacyUnsigned: false, mine };
}
