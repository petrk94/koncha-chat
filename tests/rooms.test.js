import test from 'node:test';
import assert from 'node:assert/strict';
import { createRoom } from '../public/crypto.js';
import { normalizeRooms, upsertRoom, labelForRoom } from '../public/rooms.js';

test('multiple contacts use separate rooms, no accidental overwrites', () => {
  const a = { ...createRoom(), peer: { alias:'A' } };
  const b = { ...createRoom(), peer: { alias:'B' } };
  assert.notEqual(a.roomId, b.roomId); assert.notEqual(a.secret, b.secret);
  let rooms = upsertRoom([], a);
  rooms = upsertRoom(rooms, b);
  assert.equal(rooms.length, 2);
  assert.equal(labelForRoom(rooms[0]), 'B');
  rooms = upsertRoom(rooms, { ...a, peer: {alias: 'Alex'} });
  assert.equal(rooms.length, 2);
  assert.equal(rooms[0].peer.alias, 'Alex');
  assert.equal(normalizeRooms([a, a, b]).length, 2);
  assert.throws(() => upsertRoom([a,b],createRoom(),2), /limit/);
});
