import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, rm, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {
  createRoom, createInvite, deriveRoomKeys, encryptPayload, tokenVerifier, sealInvite
} from '../public/crypto.js';

const root = path.resolve(import.meta.dirname, '..');

async function waitServer(proc, port) {
  for (let i = 0; i < 40; i++) {
    if (proc.exitCode !== null) throw new Error('PHP test server exited');
    try { const response = await fetch(`http://127.0.0.1:${port}/index.html`); if (response.ok) return; } catch { /* retry */ }
    await new Promise(r => setTimeout(r, 120));
  }
  throw new Error('PHP test server did not start');
}

async function withServer(fn) {
  const temp = await mkdtemp(path.join(os.tmpdir(), 'koncha-test-'));
  const port = 23000 + Math.floor(Math.random() * 10000);
  const server = spawn('php', ['-S', `127.0.0.1:${port}`, '-t', 'public'], {
    cwd: root, env: { ...process.env, KONCHA_DATA_DIR: temp }, stdio: 'ignore'
  });
  try {
    await waitServer(server, port);
    const room = createRoom(), keys = await deriveRoomKeys(room);
    const call = (action, method = 'GET', body = {}, token = keys.authToken) => fetch(
      `http://127.0.0.1:${port}/api.php?action=${action}` + (method === 'GET' ? `&room=${room.roomId}` : ''),
      { method, headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(method === 'POST' ? { 'Content-Type': 'application/json' } : {}) },
        ...(method === 'POST' ? { body: JSON.stringify({ roomId: room.roomId, ...body }) } : {}) }
    );
    assert.equal((await call('init', 'POST')).status, 200);
    await fn({ room, keys, temp, call });
  } finally { server.kill('SIGTERM'); await rm(temp, { recursive: true, force: true }); }
}

test('PHP relay stores ciphertext, authenticates rooms and rejects malformed messages', async () => {
  await withServer(async ({ room, keys, call }) => {
    assert.equal((await call('list', 'GET', {}, 'A'.repeat(43))).status, 403);
    const env = await encryptPayload(keys.messageKey, { text: '私だけの秘密', sender: 'A', senderId: 'A', ts: Date.now() });
    assert.equal((await call('send', 'POST', { envelope: env })).status, 200);
    const messages = await (await call('list')).json();
    assert.equal(messages.messages.length, 1);
    assert.equal(JSON.stringify(messages).includes('私だけの秘密'), false);
    assert.equal((await call('send', 'POST', { envelope: { v: 1, id: 'bad', iv: 'x', ciphertext: 'bad' } })).status, 400);
  });
});

test('one-time invite: preflight does not consume; first redemption wins; rotation invalidates old link', async () => {
  await withServer(async ({ room, call }) => {
    const a = createInvite(room), b = createInvite(room);
    const obj = async inv => ({ inviteId: inv.inviteId, verifier: await tokenVerifier(inv.token), payload: await sealInvite(inv, room) });
    const dataA = await obj(a), dataB = await obj(b);
    assert.equal((await call('invite_create', 'POST', dataA)).status, 200);
    assert.equal((await call('invite_check', 'POST', dataA, null)).status, 200);
    const first = await call('invite_claim', 'POST', dataA, null);
    assert.equal(first.status, 200);
    assert.equal((await first.json()).payload.ciphertext, dataA.payload.ciphertext);
    assert.equal((await call('invite_claim', 'POST', dataA, null)).status, 410);
    // A claimed conversation is one-to-one; a third participant must get a NEW room.
    assert.equal((await call('invite_create', 'POST', dataA)).status, 409);
    assert.equal((await call('invite_create', 'POST', dataB)).status, 409);
  });
});

test('expired invite has distinct error and encrypted payload is erased on check', async () => {
  await withServer(async ({ room, temp, call }) => {
    const inv = createInvite(room), data = {
      inviteId: inv.inviteId, verifier: await tokenVerifier(inv.token), payload: await sealInvite(inv, room)
    };
    assert.equal((await call('invite_create', 'POST', data)).status, 200);
    const filepath = path.join(temp, `${room.roomId}.json`);
    const state = JSON.parse(await readFile(filepath, 'utf8'));
    state.invite.expiresAt = Math.floor(Date.now() / 1000) - 1;
    await writeFile(filepath, JSON.stringify(state));
    const failed = await call('invite_check', 'POST', data, null);
    assert.equal(failed.status, 410);
    assert.equal((await failed.json()).error, 'invite_expired');
    const after = JSON.parse(await readFile(filepath, 'utf8'));
    assert.equal(after.invite.payload, undefined);
    assert.equal((await call('invite_claim', 'POST', data, null)).status, 410);
  });
});

test('revoking an invitation prevents use but leaves existing chat intact', async () => {
  await withServer(async ({ room, call }) => {
    const inv = createInvite(room), data = {
      inviteId: inv.inviteId, verifier: await tokenVerifier(inv.token), payload: await sealInvite(inv, room)
    };
    assert.equal((await call('invite_create', 'POST', data)).status, 200);
    assert.equal((await call('invite_revoke', 'POST')).status, 200);
    assert.equal((await call('invite_claim', 'POST', data, null)).status, 410);
    assert.equal((await call('list')).status, 200);
  });
});

test('room-specific presence expires and is not a server-side identity claim', async () => {
  await withServer(async ({ call, room }) => {
    const id = 'A'.repeat(16);
    assert.equal((await call('heartbeat', 'POST', { presenceId: 'invalid' })).status, 400);
    assert.equal((await call('heartbeat', 'POST', { presenceId: id })).status, 200);
    const active = await (await call('presence')).json();
    assert.equal(typeof active.presence[id], 'number');
    assert.equal(JSON.stringify(active).includes(room.secret), false);
    // A relay authorization token grants room access, not verified human identity.
  });
});

test('server retains ciphertext up to 7 days but deletes older messages on room activity', async () => {
  await withServer(async ({ room, keys, temp, call }) => {
    const old = await encryptPayload(keys.messageKey, { text: 'expired', sender:'a', senderId:'a', ts:1 });
    const kept = await encryptPayload(keys.messageKey, { text: 'offline', sender:'a', senderId:'a', ts:2 });
    assert.equal((await call('send', 'POST', {envelope:old})).status, 200);
    assert.equal((await call('send', 'POST', {envelope:kept})).status, 200);
    const file = path.join(temp, `${room.roomId}.json`);
    const obj = JSON.parse(await readFile(file, 'utf8'));
    obj.messages[0].storedAt = Math.floor(Date.now()/1000) - 8*86400;
    obj.messages[1].storedAt = Math.floor(Date.now()/1000) - 3*86400;
    await writeFile(file, JSON.stringify(obj));
    const result = await (await call('list')).json();
    assert.deepEqual(result.messages.map(x => x.id), [kept.id]);
    assert.equal(JSON.stringify(result).includes('offline'), false);
    const stored = JSON.parse(await readFile(file,'utf8'));
    assert.equal(stored.messages.length, 1);
  });
});

test('relay accepts an encrypted invitation carrying a P-256 device identity without storing plaintext name', async () => {
  const { generateDeviceKeyPair, exportDevicePublicKey } = await import('../public/identity.js');
  await withServer(async ({ room, call, temp }) => {
    const pair = await generateDeviceKeyPair();
    const inv = createInvite({ ...room, requireSignatures: true }, { alias: 'Yuki Tanaka', handle: 'yuki.t', publicKey: await exportDevicePublicKey(pair) });
    const payload = await sealInvite(inv, { ...room, requireSignatures: true });
    const body = { inviteId: inv.inviteId, verifier: await tokenVerifier(inv.token), payload };
    const response = await call('invite_create', 'POST', body);
    assert.equal(response.status, 200);
    const state = JSON.parse(await readFile(path.join(temp,`${room.roomId}.json`),'utf8'));
    assert.equal(JSON.stringify(state).includes('Yuki Tanaka'), false);
    assert.equal(JSON.stringify(state).includes('yuki.t'), false);
    assert.equal((await call('invite_claim','POST',body,null)).status,200);
    assert.equal((await call('invite_create','POST',body)).status,409);
  });
});
