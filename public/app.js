import { createRoom, parseInvite, inviteUrl, deriveRoomKeys, encryptPayload, decryptPayload, randomId } from './crypto.js';
import { romanizeKana } from './romanize.js';
import { getSetting, putSetting, putMessage, getMessages, resetAll } from './db.js';

const $ = id => document.getElementById(id);
const sections = ['onboarding', 'lobby', 'chat'];
const initialInvite = parseInvite(location.hash);
if (initialInvite) history.replaceState(null, '', location.pathname + location.search);
let identity = null;
let room = null;
let keys = null;
let timer = null;
let polling = false;
let currentMessages = [];
let lastErrorShown = false;

function screen(id) { sections.forEach(s => { $(s).hidden = s !== id; }); }
function toast(message) {
  const el = $('toast'); el.textContent = message; el.hidden = false;
  setTimeout(() => { if (el.textContent === message) el.hidden = true; }, 5500);
}
async function request(action, method = 'GET', envelope = null) {
  const uri = method === 'GET' ? `/api.php?action=${action}&room=${encodeURIComponent(room.roomId)}` : `/api.php?action=${action}`;
  const options = { method, cache: 'no-store', headers: { 'Authorization': `Bearer ${keys.authToken}` } };
  if (method === 'POST') {
    options.headers['Content-Type'] = 'application/json';
    options.body = JSON.stringify({ roomId: room.roomId, ...(envelope ? { envelope } : {}) });
  }
  const response = await fetch(uri, options);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
  return data;
}
function inviteLink() { return inviteUrl(location.origin + location.pathname, room); }
function showLobby() {
  clearInterval(timer); timer = null;
  room = null; keys = null;
  screen('lobby');
  $('pendingInvite').hidden = !initialInvite;
  getSetting('lastRoom').then(saved => { $('recentRoom').hidden = !saved; }).catch(() => {});
}
async function openRoom(next) {
  if (!next?.secret || !next?.roomId) throw new Error('Invalid room');
  clearInterval(timer);
  room = next;
  keys = await deriveRoomKeys(room);
  await request('init', 'POST');
  await putSetting('lastRoom', room);
  lastErrorShown = false;
  currentMessages = await getMessages(room.roomId);
  $('chatTitle').textContent = `Raum ${room.roomId.slice(0, 6)}…`;
  $('connection').textContent = 'Verbunden';
  screen('chat');
  await renderMessages();
  await poll();
  timer = setInterval(() => { void poll(); }, 2800);
}
async function poll() {
  if (polling || !room || !keys) return;
  polling = true;
  try {
    const received = await request('list');
    const known = new Set(currentMessages.map(m => m.id));
    let changed = false;
    for (const envelope of received.messages || []) {
      if (known.has(envelope.id)) continue;
      try {
        await decryptPayload(keys.messageKey, envelope); // authenticate before caching
        await putMessage(room.roomId, envelope);
        currentMessages.push(envelope);
        known.add(envelope.id);
        changed = true;
      } catch { /* deliberately discard invalid ciphertext; never show it */ }
    }
    if (changed) await renderMessages();
    $('connection').textContent = 'Verbunden';
    lastErrorShown = false;
  } catch (error) {
    $('connection').textContent = 'Offline / Fehler';
    if (!lastErrorShown) { toast(`Server nicht erreichbar: ${error.message}`); lastErrorShown = true; }
  } finally { polling = false; }
}
async function renderMessages() {
  const container = $('messages');
  container.replaceChildren();
  const displayed = [];
  for (const envelope of currentMessages) {
    try {
      const data = await decryptPayload(keys.messageKey, envelope);
      displayed.push({ ...data, id: envelope.id });
    } catch { /* local content may be corrupted */ }
  }
  displayed.sort((a, b) => a.ts - b.ts || a.id.localeCompare(b.id));
  if (!displayed.length) {
    const empty = document.createElement('p'); empty.className = 'empty';
    empty.textContent = 'Noch keine Nachrichten. Teile die Einladung mit deinem Testpartner und beginne den Chat.';
    container.append(empty);
    return;
  }
  for (const data of displayed) {
    const mine = data.senderId === identity.id;
    const card = document.createElement('article'); card.className = 'bubble' + (mine ? ' mine' : '');
    const who = document.createElement('span'); who.className = 'sender'; who.textContent = data.sender.slice(0, 32);
    const message = document.createElement('div'); message.className = 'bodytext'; message.textContent = data.text.slice(0, 2000);
    const time = document.createElement('span'); time.className = 'time'; time.textContent = new Date(data.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    card.append(who, message);
    if ($('romajiToggle').checked && /[\u3040-\u30ff]/.test(data.text)) {
      const romaji = document.createElement('div'); romaji.className = 'romanized';
      romaji.textContent = romanizeKana(data.text); card.append(romaji);
    }
    card.append(time); container.append(card);
  }
  container.scrollTop = container.scrollHeight;
}

$('startBtn').addEventListener('click', async () => {
  const alias = $('nickname').value.trim();
  if (!alias) return toast('Bitte einen Namen eingeben.');
  if (!$('ack').checked) return toast('Bitte den Prototyp-Hinweis bestätigen.');
  try {
    identity = { id: randomId(16), alias: alias.slice(0, 32) };
    await putSetting('consent', true);
    await putSetting('identity', identity);
    showLobby();
  } catch (error) { toast(`Lokale Speicherung fehlgeschlagen: ${error.message}`); }
});
$('createBtn').addEventListener('click', async () => {
  try { await openRoom(createRoom()); }
  catch (error) { showLobby(); toast(`Raum konnte nicht erstellt werden: ${error.message}`); }
});
$('joinBtn').addEventListener('click', async () => {
  if (!initialInvite) return;
  try { await openRoom(initialInvite); }
  catch (error) { showLobby(); toast(`Raum konnte nicht geöffnet werden: ${error.message}`); }
});
$('resumeBtn').addEventListener('click', async () => {
  try { const saved = await getSetting('lastRoom'); if (saved) await openRoom(saved); }
  catch (error) { showLobby(); toast(`Raum konnte nicht geöffnet werden: ${error.message}`); }
});
$('shareBtn').addEventListener('click', async () => {
  const url = inviteLink();
  try { await navigator.clipboard.writeText(url); toast('Geheimer Einladungslink kopiert. Nicht öffentlich teilen!'); }
  catch { window.prompt('Geheimer Einladungslink (manuell kopieren):', url); }
});
$('leaveBtn').addEventListener('click', showLobby);
$('romajiToggle').addEventListener('change', () => { void renderMessages(); });
$('sendForm').addEventListener('submit', async event => {
  event.preventDefault();
  const field = $('messageInput');
  const text = field.value.trim();
  if (!room || !keys || !text) return;
  $('sendBtn').disabled = true;
  try {
    const envelope = await encryptPayload(keys.messageKey, { text, sender: identity.alias, senderId: identity.id, ts: Date.now() });
    await request('send', 'POST', envelope);
    await putMessage(room.roomId, envelope);
    currentMessages.push(envelope);
    field.value = '';
    await renderMessages();
  } catch (error) { toast(`Nachricht konnte nicht gesendet werden: ${error.message}`); }
  finally { $('sendBtn').disabled = false; field.focus(); }
});
$('resetBtn').addEventListener('click', async () => {
  if (!confirm('ALLE lokalen Koncha-Daten einschließlich Raumschlüsseln und Chatverlauf löschen? Server-Nachrichten werden dadurch NICHT gelöscht.')) return;
  clearInterval(timer); timer = null;
  try { await resetAll(); location.replace(location.pathname); }
  catch (error) { toast(`Löschen fehlgeschlagen: ${error.message}`); }
});

(async () => {
  try {
    if (!globalThis.crypto?.subtle || !globalThis.indexedDB) throw new Error('Browser benötigt HTTPS, Web Crypto und IndexedDB');
    const [consent, existing] = await Promise.all([getSetting('consent'), getSetting('identity')]);
    if (consent && existing?.id && existing?.alias) { identity = existing; showLobby(); }
    else screen('onboarding');
  } catch (error) {
    screen('onboarding'); $('startBtn').disabled = true;
    toast(`Nicht unterstützt: ${error.message}`);
  }
})();
