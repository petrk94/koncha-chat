import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createRoom, deriveRoomKeys, encryptPayload } from '../public/crypto.js';

const root = path.resolve(import.meta.dirname, '..');

async function waitServer(proc, port) {
  for (let i = 0; i < 40; i++) {
    if (proc.exitCode !== null) throw new Error('PHP test server exited');
    try { const response = await fetch(`http://127.0.0.1:${port}/index.html`); if (response.ok) return; } catch { /* retry */ }
    await new Promise(r => setTimeout(r, 120));
  }
  throw new Error('PHP test server did not start');
}

test('PHP relay keeps plaintext off the server, authenticates room and rejects malformed requests', async () => {
  const temp = await mkdtemp(path.join(os.tmpdir(), 'koncha-test-'));
  const port = 23000 + Math.floor(Math.random() * 10000);
  const server = spawn('php', ['-S', `127.0.0.1:${port}`, '-t', 'public'], {
    cwd: root, env: { ...process.env, KONCHA_DATA_DIR: temp }, stdio: 'ignore'
  });
  try {
    await waitServer(server, port);
    const room = createRoom();
    const keys = await deriveRoomKeys(room);
    const base = `http://127.0.0.1:${port}/api.php`;
    const call = (action, method = 'GET', token = keys.authToken, payload = null) => fetch(
      `${base}?action=${action}` + (method === 'GET' ? `&room=${room.roomId}` : ''),
      { method, headers: { Authorization: `Bearer ${token}`, ...(method === 'POST' ? { 'Content-Type': 'application/json' } : {}) }, ...(method === 'POST' ? { body: JSON.stringify(payload) } : {}) }
    );
    const init = await call('init', 'POST', keys.authToken, { roomId: room.roomId });
    assert.equal(init.status, 200);
    const wrong = await call('list', 'GET', 'A'.repeat(43));
    assert.equal(wrong.status, 403);
    const envelope = await encryptPayload(keys.messageKey, { text: '私だけの秘密', sender: 'A', senderId: 'A', ts: Date.now() });
    const sent = await call('send', 'POST', keys.authToken, { roomId: room.roomId, envelope });
    assert.equal(sent.status, 200);
    const received = await call('list');
    assert.equal(received.status, 200);
    const result = await received.json();
    assert.equal(result.messages.length, 1);
    assert.equal(JSON.stringify(result).includes('私だけの秘密'), false);
    const invalid = await call('send', 'POST', keys.authToken, { roomId: room.roomId, envelope: { v: 1, id: 'bad', iv: 'x', ciphertext: 'bad' } });
    assert.equal(invalid.status, 400);
  } finally {
    server.kill('SIGTERM');
    await rm(temp, { recursive: true, force: true });
  }
});
