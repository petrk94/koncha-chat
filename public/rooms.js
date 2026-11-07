/** Local room index (secrets are stored only in this browser's IndexedDB). */
export function normalizeRooms(rooms) {
  if (!Array.isArray(rooms)) return [];
  const map = new Map();
  for (const room of rooms) {
    if (room && typeof room.roomId === 'string' && typeof room.secret === 'string') {
      map.set(room.roomId, room);
    }
  }
  return Array.from(map.values());
}
export function upsertRoom(rooms, room, limit = 30) {
  if (!room?.roomId || !room?.secret) throw new Error('Invalid conversation');
  const existing = normalizeRooms(rooms).filter(r => r.roomId !== room.roomId);
  if (existing.length >= limit) throw new Error(`Conversation limit (${limit}) reached`);
  return [room, ...existing];
}
export function labelForRoom(room) {
  return room?.peer?.alias || 'Neues Gespräch';
}
