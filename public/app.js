import {
  createRoom, createInvite, parseInvite, inviteUrl, tokenVerifier, sealInvite, unsealInvite,
  deriveRoomKeys, encryptPayload, decryptPayload, randomId
} from './crypto.js';
import { romanizeKana } from './romanize.js';
import { getSetting, putSetting, putMessage, getMessages, resetAll, putVerifiedMessage } from './db.js';
import { applyLanguage, translate } from './i18n.js';
import { browserTranslation } from './translation.js';
import { pwaFeatureReport, formatPwaReport } from './pwa-diagnostics.js';
import { AttentionController } from './notifications.js';
import { generateDeviceKeyPair, exportDevicePublicKey, deviceFingerprint, signChatPayload } from './identity.js';
import { authenticateRoomMessage } from './message-policy.js';
import { normalizeRooms, upsertRoom, labelForRoom } from './rooms.js';
import { translationCapabilities } from './translation-capabilities.js';
import { runTranslationSelfTest } from './translation-selftest.js';
import { subscribeRoomPush, unsubscribeRoomPush } from './push-client.js';
import {
  isOlmRoom, createSecureRoom, rotateSecureInvite, acceptSecureInvite,
  receiveSecureEnvelope, sendSecureMessage, retrySecureOutbox,
  visibleSecureMessages, ownSecureFingerprint, localOlmFingerprint
} from './olm-transport.js';
import { readOlmState, getOlmHistory } from './olm-store.js';

const $ = id => document.getElementById(id);
const sections = ['onboarding', 'lobby', 'invitation', 'chat'];
let pendingInvite = parseInvite(location.hash);
const malformedInvite = location.hash.startsWith('#invite=') && !pendingInvite;
if (location.hash) history.replaceState(null, '', location.pathname + location.search);
let locale = 'de';
let identity = null;
let deviceKeyPair = null;
let rooms = [];
const unreadByRoom = new Map();
const roomPrimed = new Set();
let backgroundTimer = null;
let presenceTimer = null;
let backgroundPolling = false;
let presenceEnabled = false;
let room = null;
let keys = null;
let pollTimer = null;
let inviteTimer = null;
let pendingTimer = null;
let activeInvite = null;
let invitationAccepted = false;
let incomingExpiresAt = 0;
let polling = false;
let currentMessages = [];
let lastErrorShown = false;
let translateSession = null;
let translationGeneration = 0;
const translationCache = new Map();
const t = name => translate(name, locale);
const attention = new AttentionController({ labels: () => ({ title: t('notificationTitle'), body: t('notificationBody') }) });
let pollIsInitialized = false;

function screen(id) {
  sections.forEach(s => { $(s).hidden = s !== id; });
  closePreferences();
}
function avatarFor(name) { return [...String(name || 'こ').trim()][0] || 'こ'; }
function showIdentity() {
  $('lobbyAlias').textContent = identity.alias;
  $('lobbyHandle').textContent = '@' + identity.handle;
  $('lobbyAvatar').textContent = avatarFor(identity.alias);
}
function updateConversation() {
  const peer = room?.peer;
  const label = peer?.alias || t('chatName');
  $('contactName').textContent = label;
  $('headerAvatar').textContent = avatarFor(peer?.alias);
  $('contactHandle').textContent = peer?.handle ? '@' + peer.handle : '';
  void refreshDeviceCodes();
  renderRoomIndex();
}
function renderRoomIndex() {
  const targets = [['roomList', true], ['savedRooms', false]];
  for (const [id, sidebar] of targets) {
    const container = $(id); container.replaceChildren();
    for (const conversation of rooms) {
      const btn = document.createElement('button'); btn.type = 'button';
      btn.className = sidebar ? 'room-row' : 'saved-row';
      if (sidebar) btn.setAttribute('aria-current', String(room?.roomId === conversation.roomId));
      const label = document.createElement('span');
      if (sidebar) {
        label.className = 'room-row-body';
        const title = document.createElement('strong'); title.textContent = labelForRoom(conversation);
        const sub = document.createElement('small'); sub.textContent = conversation.peer?.handle ? '@' + conversation.peer.handle : t('chatSubtitle');
        label.append(title, sub);
        const avatar = document.createElement('span'); avatar.className = 'small-avatar'; avatar.textContent = avatarFor(labelForRoom(conversation));
        btn.append(avatar, label);
      } else {
        const title = document.createElement('strong'); title.textContent = labelForRoom(conversation);
        const sub = document.createElement('small'); sub.textContent = conversation.peer?.handle ? '@' + conversation.peer.handle : t('resume');
        label.append(title, document.createTextNode(' '), sub); btn.append(label);
      }
      const n = unreadByRoom.get(conversation.roomId) || 0;
      if (n > 0) { const badge = document.createElement('span'); badge.className = 'room-unread'; badge.textContent = n > 99 ? '99+' : String(n); btn.append(badge); }
      btn.addEventListener('click', () => { void openRoom(conversation).catch(err => toast(`${t('roomError')}: ${err.message}`)); });
      container.append(btn);
    }
  }
}
async function saveRoomRecord(changed) {
  rooms = upsertRoom(rooms, changed);
  await putSetting('rooms', rooms);
  if (room?.roomId === changed.roomId) await putSetting('lastRoom', changed);
  renderRoomIndex();
}
async function initializeDeviceKey() {
  deviceKeyPair = await getSetting('deviceKeyPair');
  if (!deviceKeyPair) {
    deviceKeyPair = await generateDeviceKeyPair();
    await putSetting('deviceKeyPair', deviceKeyPair);
  }
  identity.publicKey = await exportDevicePublicKey(deviceKeyPair);
  identity.fingerprint = await deviceFingerprint(identity.publicKey);
  await putSetting('identity', identity);
}
async function refreshDeviceCodes() {
  if (!identity || !room) return;
  const secure = isOlmRoom(room);
  $('deviceFingerprint').textContent = secure ? await ownSecureFingerprint(room).catch(()=> '—') : identity.fingerprint || '—';
  $('peerFingerprint').textContent = secure
    ? room.peer?.olmCurve ? await localOlmFingerprint(room.peer.olmCurve,room.peer.olmEd||'').catch(()=> '—') : t('peerUnknown')
    : room.peer?.publicKey ? await deviceFingerprint(room.peer.publicKey).catch(() => '—') : t('peerUnknown');
  $('verificationState').textContent = room.peer?.verified ? t('peerVerified') : t('peerUnverified');
  $('verifyPeerBtn').disabled = secure ? !room.peer?.olmCurve || !!room.peer?.verified : !room.peer?.publicKey || !!room.peer?.verified;
}
async function checkedMessage(chatRoom, chatKeys, envelope, fromLocalCache = false) {
  const message = await decryptPayload(chatKeys.messageKey, envelope);
  const verdict = await authenticateRoomMessage(chatRoom, message, identity, { fromLocalCache });
  message.legacyUnsigned = verdict.legacyUnsigned;
  const mine = verdict.mine;
  if (!mine && !chatRoom.peer?.publicKey) {
    chatRoom.peer = { alias: String(message.sender).slice(0, 32), handle: String(message.senderHandle || '').slice(0, 24), publicKey: message.publicKey, presenceId: message.presenceId || '', verified: false };
    await saveRoomRecord(chatRoom); // Trust on first valid signed message; verify out-of-band.
    if (room?.roomId === chatRoom.roomId) updateConversation();
  }
  if (!mine && chatRoom.peer?.publicKey && message.presenceId && !chatRoom.peer.presenceId) {
    chatRoom.peer.presenceId = message.presenceId;
    await saveRoomRecord(chatRoom);
  }
  return message;
}

function showInvitation() {
  clearInterval(pendingTimer); pendingTimer = null;
  $('inviteError').hidden = true;
  $('joinBtn').hidden = !pendingInvite;
  $('inviterCard').hidden = !pendingInvite?.sender;
  $('inviterName').textContent = pendingInvite?.sender || '';
  $('inviterHandle').textContent = pendingInvite?.handle ? '@' + pendingInvite.handle : '';
  $('inviterAvatar').textContent = avatarFor(pendingInvite?.sender);
  $('inviteDescription').textContent = pendingInvite?.sender ? t('inviteFromDescription') : t('invitePageLead');
  $('incomingExpiry').textContent = t('checkingInvite');
  screen('invitation');
  if (malformedInvite && !pendingInvite) return inviteProblem(new Error('invalid_invitation'));
  if (pendingInvite) {
    void checkPendingInvite();
    pendingTimer = setInterval(() => { void checkPendingInvite(); }, 15000);
  }
}
function closePreferences() {
  const layer = $('chatPreferences');
  if (!layer) return;
  const wasOpen = !layer.hidden;
  layer.hidden = true;
  $('chatHeaderBtn').setAttribute('aria-expanded', 'false');
  $('settingsBtn').setAttribute('aria-expanded', 'false');
  if (wasOpen) $('settingsBtn').focus();
}
function togglePreferences() {
  const layer = $('chatPreferences');
  if (!layer.hidden) return closePreferences();
  layer.hidden = false;
  $('chatHeaderBtn').setAttribute('aria-expanded', 'true');
  $('settingsBtn').setAttribute('aria-expanded', 'true');
  layer.querySelector('.preferences').focus();
}
function toast(message) {
  const el = $('toast'); el.textContent = message; el.hidden = false;
  setTimeout(() => { if (el.textContent === message) el.hidden = true; }, 5000);
}
function setLanguage(lang) {
  locale = ['de', 'en', 'ja'].includes(lang) ? lang : 'en';
  $('languageSelect').value = locale;
  applyLanguage(document, locale);
  if (room) { $('connection').textContent = t('presenceUnknown'); updateConversation(); void renderMessages(); }
  if (pendingInvite && !$('invitation').hidden) $('inviteDescription').textContent = pendingInvite.sender ? t('inviteFromDescription') : t('invitePageLead');
}
function registerAppShell() {
  if ('serviceWorker' in navigator && globalThis.isSecureContext) {
    void navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {});
  }
}
function preferredLanguage() {
  for (const item of navigator.languages || [navigator.language]) {
    const code = String(item).split('-')[0].toLowerCase();
    if (['de', 'en', 'ja'].includes(code)) return code;
  }
  return 'en';
}
async function api(action, { method = 'GET', body = {}, authenticated = true, contextRoom = room, contextKeys = keys } = {}) {
  const url = new URL('/api.php', location.origin);
  url.searchParams.set('action', action);
  if (method === 'GET') url.searchParams.set('room', contextRoom.roomId);
  const headers = {};
  if (authenticated) {
    if (!contextKeys) throw new Error('Missing room keys');
    headers.Authorization = `Bearer ${contextKeys.authToken}`;
  }
  if (method === 'POST') headers['Content-Type'] = 'application/json';
  const response = await fetch(url, {
    method, cache: 'no-store', credentials: 'omit', headers,
    ...(method === 'POST' ? { body: JSON.stringify({ roomId: contextRoom?.roomId ?? body.roomId, ...body }) } : {})
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
  return data;
}
function inviteProblem(error) {
  const message = error.message === 'invite_expired' ? t('inviteExpired')
    : error.message === 'invite_unavailable' ? t('inviteUnavailable')
    : error.message === 'invite_identity_mismatch' ? t('identityMismatch') : t('inviteInvalid');
  $('inviteError').textContent = message;
  $('inviteError').hidden = false;
  $('joinBtn').hidden = true;
  $('incomingExpiry').textContent = t('inviteInactive');
  $('inviterCard').hidden = true;
  clearInterval(pendingTimer); pendingTimer = null;
  pendingInvite = null;
  invitationAccepted = false;
  screen('invitation');
}
function showLobby() {
  attention.clear();
  pollIsInitialized = false;
  clearInterval(pollTimer); pollTimer = null;
  clearInterval(inviteTimer); inviteTimer = null;
  clearInterval(pendingTimer); pendingTimer = null;
  room = null; keys = null; activeInvite = null;
  translateSession?.dispose(); translateSession = null;
  invitationAccepted = false;
  $('inviteStatus').hidden = true;
  showIdentity();
  screen('lobby');
  $('recentRoom').hidden = true;
  renderRoomIndex();
}
async function checkPendingInvite() {
  const invite = pendingInvite;
  if (!invite) return;
  try {
    const result = await api('invite_check', { method: 'POST', authenticated: false,
      body: { roomId: invite.roomId, inviteId: invite.inviteId, verifier: await tokenVerifier(invite.token) } });
    if (pendingInvite !== invite) return;
    incomingExpiresAt = result.expiresAt;
    if (incomingExpiresAt <= Date.now() / 1000) return inviteProblem(new Error('invite_expired'));
    const minutes = Math.max(1, Math.ceil((incomingExpiresAt - Date.now() / 1000) / 60));
    $('incomingExpiry').textContent = t('inviteMinutes').replace('{minutes}', String(minutes));
  } catch (error) { if (pendingInvite === invite) inviteProblem(error); }
}
async function claimPendingInvite() {
  if (!pendingInvite || !identity) return;
  $('joinBtn').disabled = true;
  try {
    const inv = pendingInvite;
    // Preflight again after a potentially long identity setup.
    await checkPendingInvite();
    if (pendingInvite !== inv) return;
    const result = await api('invite_claim', { method: 'POST', authenticated: false,
      body: { roomId: inv.roomId, inviteId: inv.inviteId, verifier: await tokenVerifier(inv.token) } });
    const claimedRoom = await unsealInvite(inv, result.payload);
    if (isOlmRoom(claimedRoom)) await acceptSecureInvite(claimedRoom, identity);
    pendingInvite = null; invitationAccepted = false;
    await openRoom(claimedRoom);
  } catch (error) { inviteProblem(error); }
  finally { $('joinBtn').disabled = false; }
}
async function openRoom(next) {
  if (!next?.roomId || !next?.secret) throw new Error('Invalid room');
  clearInterval(pollTimer);
  clearInterval(inviteTimer);
  clearInterval(pendingTimer); pendingTimer = null;
  attention.clear();
  unreadByRoom.delete(next.roomId);
  pollIsInitialized = false;
  room = next;
  if (!room.presenceId) room.presenceId = randomId(12);
  keys = await deriveRoomKeys(room); // relay-only auth for Olm rooms, no chat AES.
  if (isOlmRoom(room) && !await readOlmState(room.roomId))
    throw new Error('Missing original Olm session; key recovery is unavailable');
  // Saved conversations remain readable from IndexedDB without a network.
  // New rooms still require the relay to initialize successfully.
  const alreadySaved = rooms.some(item => item.roomId === room.roomId);
  try { await api('init', { method: 'POST' }); }
  catch (error) { if (!alreadySaved) throw error; }
  await saveRoomRecord(room);
  lastErrorShown = false;
  activeInvite = null;
  currentMessages = isOlmRoom(room)
    ? (await getOlmHistory(room.roomId)).map(entry => ({id:entry.id,v:2}))
    : await getMessages(room.roomId);
  updateConversation();
  $('connection').textContent = t('connecting');
  $('chatDeviceId').textContent = identity.id.slice(0, 12) + '…';
  $('inviteStatus').hidden = true;
  screen('chat');
  await restoreChatPreferences();
  await renderMessages();
  await poll(); // also flushes durable Olm handshake/outbox; safe to retry.
  pollTimer = setInterval(() => { void poll(); }, 2800);
  if (presenceEnabled) void pulsePresence();
}
async function poll() {
  if (polling || !room || !keys) return;
  polling = true;
  try {
    const snapshotRoom = room;
    const snapshotKeys = keys;
    const received = await api('list', { contextRoom: snapshotRoom, contextKeys: snapshotKeys });
    if (room !== snapshotRoom) return;
    const known = new Set(currentMessages.map(m => m.id));
    let changed = false;
    let newFromOthers = 0;
    for (const envelope of received.messages || []) {
      if (known.has(envelope.id)) continue;
      try {
        const message = await checkedMessage(snapshotRoom, snapshotKeys, envelope);
        const stored = message.signature
          ? await putVerifiedMessage(snapshotRoom.roomId, envelope, message.senderId, message.nonce)
          : (await putMessage(snapshotRoom.roomId, envelope), true);
        if (!stored) continue;
        if (message.senderId !== identity.id) newFromOthers++;
        currentMessages.push(envelope);
        known.add(envelope.id);
        changed = true;
      } catch { /* Ignore unauthenticated ciphertext. */ }
    }
    if (changed) await renderMessages();
    // Initial sync may contain old messages. Only alert for later arrivals.
    if (pollIsInitialized && newFromOthers > 0) attention.incoming(newFromOthers);
    pollIsInitialized = true;
    roomPrimed.add(snapshotRoom.roomId);
    await refreshPresence(snapshotRoom, snapshotKeys);
    lastErrorShown = false;
  } catch (error) {
    $('connection').textContent = t('offline');
    if (!lastErrorShown) { toast(`${t('serverError')}: ${error.message}`); lastErrorShown = true; }
  } finally { polling = false; }
}
async function renderMessages() {
  const generation = ++translationGeneration;
  const container = $('messages');
  container.replaceChildren();
  const displayed = [];
  for (const envelope of currentMessages) {
    try {
      const data = await checkedMessage(room, keys, envelope, true);
      displayed.push({ ...data, id: envelope.id });
    } catch { /* Corrupted local data is never displayed. */ }
  }
  if (generation !== translationGeneration) return;
  displayed.sort((a, b) => a.ts - b.ts || a.id.localeCompare(b.id));
  if (!displayed.length) {
    const empty = document.createElement('div'); empty.className = 'empty-state';
    const title = document.createElement('strong'); title.textContent = t('emptyTitle');
    const hint = document.createElement('p'); hint.textContent = t('emptyText');
    empty.append(title, hint); container.append(empty); return;
  }
  for (const data of displayed) {
    const mine = data.senderId === identity.id;
    const bubble = document.createElement('article'); bubble.className = `bubble${mine ? ' mine' : ''}`;
    const who = document.createElement('span'); who.className = 'sender'; who.textContent = data.sender.slice(0, 32);
    const message = document.createElement('div'); message.className = 'bodytext'; message.textContent = data.text.slice(0, 2000);
    const time = document.createElement('span'); time.className = 'time';
    time.textContent = new Date(data.ts).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
    bubble.append(who, message);
    if (data.legacyUnsigned) bubble.title = t('unsignedMessage');
    if ($('romajiToggle').checked && /[\u3040-\u30ff]/.test(data.text)) {
      const guide = document.createElement('div'); guide.className = 'romanized';
      guide.textContent = romanizeKana(data.text); bubble.append(guide);
    }
    if (!mine && $('translationToggle').checked && translateSession && $('sourceLanguage').value !== $('targetLanguage').value) {
      const translated = document.createElement('div'); translated.className = 'translated';
      translated.textContent = '…'; bubble.append(translated);
      const from = $('sourceLanguage').value;
      const to = $('targetLanguage').value;
      const key = `${data.id}:${from}:${to}`;
      if (translationCache.has(key)) translated.textContent = translationCache.get(key);
      else {
        // Translation is exclusively on the receiving device. The original stays unchanged.
        void translateSession.translate(data.text, from, to).then(text => {
          translationCache.set(key, text);
          if (generation === translationGeneration) translated.textContent = text;
        }).catch(() => { if (generation === translationGeneration) translated.textContent = t('noTranslation'); });
      }
    }
    bubble.append(time); container.append(bubble);
  }
  container.scrollTop = container.scrollHeight;
}
function updateInviteCountdown() {
  if (!activeInvite) return;
  const seconds = Math.max(0, activeInvite.expiresAt - Math.floor(Date.now() / 1000));
  if (!seconds) {
    activeInvite = null;
    clearInterval(inviteTimer);
    $('inviteStatus').hidden = true;
    toast(t('inviteExpired'));
    return;
  }
  $('inviteCountdown').textContent = `${t('inviteExpires')}: ${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}
async function makeInvite() {
  if (isOlmRoom(room)) await rotateSecureInvite(room);
  const inv = createInvite(room, identity);
  const [verifier, payload] = await Promise.all([tokenVerifier(inv.token), sealInvite(inv, room)]);
  const result = await api('invite_create', { method: 'POST', body: { inviteId: inv.inviteId, verifier, payload } });
  activeInvite = { expiresAt: result.expiresAt };
  $('inviteStatus').hidden = false;
  updateInviteCountdown();
  clearInterval(inviteTimer);
  inviteTimer = setInterval(updateInviteCountdown, 1000);
  const url = inviteUrl(location.origin + location.pathname, inv);
  try { await navigator.clipboard.writeText(url); toast(t('inviteCopied')); }
  catch { window.prompt(t('copyPrompt'), url); }
}
async function restoreChatPreferences() {
  const saved = await getSetting(`prefs:${room.roomId}`) || {};
  $('romajiToggle').checked = !!saved.romaji;
  $('enterToggle').checked = saved.enterSend !== false;
  $('translationToggle').checked = false; // translation always requires explicit opt-in per chat visit
  $('sourceLanguage').value = saved.source || 'ja';
  $('targetLanguage').value = saved.target || locale;
  $('translationStatus').textContent = t('translationHint');
  $('pushStatus').textContent = t('webPushInfo');
  translateSession?.dispose(); translateSession = null;
  translationGeneration++;
}
async function saveChatPreferences() {
  if (!room) return;
  await putSetting(`prefs:${room.roomId}`, {
    romaji: $('romajiToggle').checked, enterSend: $('enterToggle').checked,
    source: $('sourceLanguage').value, target: $('targetLanguage').value
  });
}
async function enableTranslation() {
  if (!$('translationToggle').checked) {
    translateSession?.dispose(); translateSession = null;
    $('translationStatus').textContent = t('translationHint');
    await renderMessages(); return;
  }
  const from = $('sourceLanguage').value, to = $('targetLanguage').value;
  if (from === to) { toast(t('chooseDifferent')); $('translationToggle').checked = false; return; }
  $('translationStatus').textContent = t('translationDownload');
  try {
    const caps = await translationCapabilities();
    // A native Translator API may exist but not support the selected language
    // pair. Consent to the large self-hosted WASM fallback only when needed.
    let nativePair = false;
    try {
      if (caps.native) nativePair = (await globalThis.Translator.availability({sourceLanguage:from,targetLanguage:to})) !== 'unavailable';
    } catch { /* Browser model unavailable for this pair. */ }
    if (!nativePair && caps.localModelBundled && !confirm(t('modelConsent'))) throw new Error('Model download declined');
    const session = await browserTranslation({ status: text => { $('translationStatus').textContent = text; } });
    await session.prepare(from, to);
    if (!$('translationToggle').checked) { session.dispose(); return; }
    translateSession?.dispose(); translateSession = session;
    $('translationStatus').textContent = t('translationAvailable');
    await renderMessages();
  } catch (error) {
    $('translationToggle').checked = false;
    $('translationStatus').textContent = `${t('translationUnsupported')} (${error.message})`;
    translateSession = null;
    await renderMessages();
  }
}


async function pulsePresence() {
  if (!presenceEnabled || document.hidden || !identity || !rooms.length) return;
  for (const chatRoom of rooms) {
    try {
      if (!chatRoom.presenceId) continue;
      const chatKeys = await deriveRoomKeys(chatRoom);
      await api('heartbeat', { method: 'POST', body: { presenceId: chatRoom.presenceId }, contextRoom: chatRoom, contextKeys: chatKeys });
    } catch { /* Connection may be unavailable. Privacy opt-in remains local. */ }
  }
}
async function refreshPresence(chatRoom, chatKeys) {
  if (!chatRoom?.peer?.presenceId || !presenceEnabled) { $('connection').textContent = t('presenceUnknown'); return; }
  try {
    const result = await api('presence', { contextRoom: chatRoom, contextKeys: chatKeys });
    if (room?.roomId !== chatRoom.roomId) return;
    const timestamp = result.presence?.[chatRoom.peer.presenceId];
    $('connection').textContent = typeof timestamp === 'number' && Date.now()/1000 - timestamp < 70 ? t('peerOnline') : t('peerOffline');
  } catch { if (room?.roomId === chatRoom.roomId) $('connection').textContent = t('offline'); }
}
async function pollOtherRooms() {
  if (backgroundPolling || !identity || !rooms.length) return;
  backgroundPolling = true;
  try {
    for (const chatRoom of [...rooms]) {
      if (room?.roomId === chatRoom.roomId) continue;
      try {
        const chatKeys = await deriveRoomKeys(chatRoom);
        const [remote, cached] = await Promise.all([
          api('list', { contextRoom: chatRoom, contextKeys: chatKeys }), getMessages(chatRoom.roomId)
        ]);
        const known = new Set(cached.map(e => e.id));
        let incomingCount = 0;
        for (const envelope of remote.messages || []) {
          if (known.has(envelope.id)) continue;
          try {
            const msg = await checkedMessage(chatRoom, chatKeys, envelope);
            const stored = msg.signature
              ? await putVerifiedMessage(chatRoom.roomId, envelope, msg.senderId, msg.nonce)
              : (await putMessage(chatRoom.roomId, envelope), true);
            if (!stored) continue;
            known.add(envelope.id);
            if (msg.senderId !== identity.id) incomingCount++;
          } catch { /* Invalid signatures, ciphertext or rotated keys are discarded. */ }
        }
        if (roomPrimed.has(chatRoom.roomId) && incomingCount > 0) {
          unreadByRoom.set(chatRoom.roomId, (unreadByRoom.get(chatRoom.roomId) || 0) + incomingCount);
          attention.incoming(incomingCount);
          renderRoomIndex();
        }
        roomPrimed.add(chatRoom.roomId);
      } catch { /* No active server / offline partner. Retry next poll. */ }
    }
  } finally { backgroundPolling = false; }
}

// One-time user activation permits Web Audio on supporting browsers.
// Background browsers may still suspend audio despite this action.
document.addEventListener('pointerdown', () => attention.unlockAudio(), { once: true, capture: true });
document.addEventListener('keydown', () => attention.unlockAudio(), { once: true, capture: true });
$('soundToggle').addEventListener('change', async () => {
  attention.setSound($('soundToggle').checked);
  if ($('soundToggle').checked) attention.unlockAudio();
  await putSetting('alertSound', $('soundToggle').checked);
});
$('pushSubscribeBtn').addEventListener('click', async () => {
  if (!room || !keys) return;
  $('pushSubscribeBtn').disabled = true;
  const activeRoom = room, activeKeys = keys;
  try {
    await subscribeRoomPush({ api, room: activeRoom, keys: activeKeys });
    $('pushStatus').textContent = t('webPushEnabled');
  } catch (error) { $('pushStatus').textContent = error.message; }
  finally { $('pushSubscribeBtn').disabled = false; }
});
$('pushUnsubscribeBtn').addEventListener('click', async () => {
  if (!room || !keys) return;
  try {
    await unsubscribeRoomPush({ api, room, keys });
    $('pushStatus').textContent = t('webPushDisabled');
  } catch (error) { $('pushStatus').textContent = error.message; }
});
$('notifyBtn').addEventListener('click', async () => {
  const status = await attention.requestPermission();
  $('notificationStatus').textContent = t(status === 'granted' ? 'notificationsReady' : status === 'denied' ? 'notificationsDenied' : 'notificationsUnavailable');
});
$('presenceToggle').addEventListener('change', async () => {
  presenceEnabled = $('presenceToggle').checked;
  await putSetting('presenceEnabled', presenceEnabled);
  if (presenceEnabled) await pulsePresence();
  if (room && keys) await refreshPresence(room, keys);
});
$('verifyPeerBtn').addEventListener('click', async () => {
  if (!room?.peer || room.peer.verified) return;
  const code = isOlmRoom(room)
    ? await localOlmFingerprint(room.peer.olmCurve,room.peer.olmEd||'')
    : await deviceFingerprint(room.peer.publicKey);
  if (!confirm(`${t('verifyInstructions')}\n\n${code}`)) return;
  room.peer.verified = true;
  await saveRoomRecord(room);
  await refreshDeviceCodes();
});
$('checkTranslationBtn').addEventListener('click', async () => {
  const output = $('translationCapability');
  const button = $('checkTranslationBtn');
  button.disabled = true;
  try {
    const info = await translationCapabilities();
    output.textContent = info.native ? t('localAINative') : info.localModelBundled ? `${t('localAIInstalled')}: ${info.installedPairs.join(', ')}` : info.webGPU ? t('localAIGPUUnconfigured') : info.wasm ? t('localAIWASMUnconfigured') : t('localAIUnavailable');
    const from = $('sourceLanguage').value, to = $('targetLanguage').value;
    if (from === to) { output.textContent = t('chooseDifferent'); return; }
    // This click authorizes a diagnostic, not a silent model download.
    if (!info.native && !info.localModelBundled) return;
    if (!confirm(t('modelConsent'))) return;
    output.textContent = t('translationDownload');
    const result = await runTranslationSelfTest({
      from, to, createSession: browserTranslation,
      onProgress: message => { output.textContent = message; }
    });
    // Fixed, non-private sample text only; no chat messages leave the device.
    output.textContent = `${t('translationAvailable')} · ${result.elapsedMs} ms · ${result.output}`;
  } catch (error) {
    output.textContent = `${t('translationUnsupported')} (${error.message})`;
  } finally { button.disabled = false; }
});
$('pwaCheckBtn').addEventListener('click', () => {
  $('pwaReport').textContent = formatPwaReport(pwaFeatureReport(), locale);
});
$('languageSelect').addEventListener('change', async () => { setLanguage($('languageSelect').value); await putSetting('locale', locale); });
$('startBtn').addEventListener('click', async () => {
  const alias = $('nickname').value.trim();
  if (!alias) return toast(t('invalidName'));
  if (!$('ack').checked) return toast(t('confirmAck'));
  try {
    const handle = $('handle').value.trim().toLowerCase().replace(/^@/, '');
    if (!/^[a-z][a-z0-9._-]{2,23}$/.test(handle)) return toast(t('invalidHandle'));
    identity = { id: randomId(16), alias: alias.slice(0, 32), handle };
    await putSetting('consent', true); await putSetting('identity', identity);
    registerAppShell();
    await initializeDeviceKey();
    if (invitationAccepted && pendingInvite) await claimPendingInvite();
    else showLobby();
  } catch (error) { toast(`${t('localError')}: ${error.message}`); }
});
$('createBtn').addEventListener('click', async () => {
  try { await openRoom(await createSecureRoom()); }
  catch (error) { showLobby(); toast(`${t('roomError')}: ${error.message}`); }
});
$('joinBtn').addEventListener('click', async () => {
  if (!pendingInvite) return;
  invitationAccepted = true;
  if (!identity) {
    $('onboarding').querySelector('h1').textContent = t('onboardInvitedTitle');
    screen('onboarding');
    $('nickname').focus();
  } else await claimPendingInvite();
});
$('rejectInviteBtn').addEventListener('click', () => {
  pendingInvite = null; invitationAccepted = false;
  if (identity) showLobby(); else screen('onboarding');
});
$('lobbyResetBtn').addEventListener('click', () => $('resetBtn').click());
$('mobileBackBtn').addEventListener('click', showLobby);
$('sidebarNewChatBtn').addEventListener('click', showLobby);
$('resumeBtn').addEventListener('click', async () => {
  try { const previous = await getSetting('lastRoom'); if (previous) await openRoom(previous); }
  catch (error) { showLobby(); toast(`${t('roomError')}: ${error.message}`); }
});
$('shareBtn').addEventListener('click', async () => {
  $('shareBtn').disabled = true;
  try { await makeInvite(); } catch (error) { toast(error.message === 'room_already_joined' ? t('inviteAlreadyJoined') : `${t('invitationError')}: ${error.message}`); }
  finally { $('shareBtn').disabled = false; }
});
$('revokeBtn').addEventListener('click', async () => {
  try {
    await api('invite_revoke', { method: 'POST' });
    activeInvite = null; $('inviteStatus').hidden = true;
    clearInterval(inviteTimer); toast(t('revokeDone'));
  } catch (error) { toast(`${t('revokeError')}: ${error.message}`); }
});
$('leaveBtn').addEventListener('click', showLobby);
$('chatHeaderBtn').addEventListener('click', togglePreferences);
$('settingsBtn').addEventListener('click', togglePreferences);
$('closePreferences').addEventListener('click', closePreferences);
$('preferencesBackdrop').addEventListener('click', closePreferences);
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && !$('chatPreferences').hidden) closePreferences();
});
$('romajiToggle').addEventListener('change', () => { void saveChatPreferences(); void renderMessages(); });
$('enterToggle').addEventListener('change', () => { void saveChatPreferences(); });
$('translationToggle').addEventListener('change', () => { void enableTranslation(); });
for (const id of ['sourceLanguage', 'targetLanguage']) $(id).addEventListener('change', () => {
  void saveChatPreferences();
  if ($('translationToggle').checked) void renderMessages();
});
$('messageInput').addEventListener('keydown', event => {
  // Japanese IME uses Enter to accept kana/kanji candidates, never intercept composition.
  if (event.key === 'Enter' && !event.shiftKey && !event.isComposing && event.keyCode !== 229 && $('enterToggle').checked) {
    event.preventDefault();
    if (!$('sendBtn').disabled) $('sendForm').requestSubmit();
  }
});
$('emojiBtn').addEventListener('click', () => {
  $('emojiPicker').hidden = !$('emojiPicker').hidden;
  $('emojiBtn').setAttribute('aria-expanded', String(!$('emojiPicker').hidden));
});
$('emojiPicker').addEventListener('click', event => {
  const button = event.target.closest('button'); if (!button) return;
  const input = $('messageInput');
  input.setRangeText(button.textContent, input.selectionStart, input.selectionEnd, 'end');
  $('emojiPicker').hidden = true; $('emojiBtn').setAttribute('aria-expanded', 'false'); input.focus();
});
$('sendForm').addEventListener('submit', async event => {
  event.preventDefault();
  const field = $('messageInput');
  const text = field.value.trim();
  if (!room || !keys || !text) return;
  $('sendBtn').disabled = true;
  try {
    const signed = await signChatPayload(deviceKeyPair, room.roomId, { text, sender: identity.alias, senderHandle: identity.handle, senderId: identity.id, ts: Date.now(), nonce: randomId(16), presenceId: room.presenceId });
    const envelope = await encryptPayload(keys.messageKey, signed);
    await api('send', { method: 'POST', body: { envelope, senderPresenceId: room.presenceId } });
    await putVerifiedMessage(room.roomId, envelope, identity.id, signed.nonce);
    currentMessages.push(envelope); field.value = '';
    await renderMessages();
  } catch (error) { toast(`${t('sendError')}: ${error.message}`); }
  finally { $('sendBtn').disabled = false; field.focus(); }
});
$('resetBtn').addEventListener('click', async () => {
  if (!confirm(t('resetConfirm'))) return;
  clearInterval(pollTimer); clearInterval(backgroundTimer); clearInterval(presenceTimer); clearInterval(inviteTimer); clearInterval(pendingTimer);
  translateSession?.dispose(); translateSession = null;
  attention.clear();
  try {
    // A PushSubscription is shared across chats in the same PWA scope. Revoke
    // every server-side registration BEFORE destroying the local room keys.
    // If offline, warn: losing keys would prevent us from revoking remotely.
    try {
      const reg = await navigator.serviceWorker?.getRegistration?.('/');
      const sub = await reg?.pushManager?.getSubscription?.();
      if (sub) {
        for (const item of rooms) {
          const itemKeys = await deriveRoomKeys(item);
          await api('push_unsubscribe', { method:'POST', contextRoom:item, contextKeys:itemKeys,
            body:{ deviceId:item.presenceId, endpoint:sub.endpoint } });
        }
        await sub.unsubscribe();
      }
    } catch (error) {
      if (!confirm(t('resetPushWarning'))) return;
    }
    await resetAll(); location.replace(location.pathname);
  }
  catch (error) { toast(`${t('resetError')}: ${error.message}`); }
});

(async () => {
  try {
    if (!globalThis.crypto?.subtle || !globalThis.indexedDB) throw new Error(t('unsupported'));
    const [consent, existing, savedLocale, soundSetting] = await Promise.all([
      getSetting('consent'), getSetting('identity'), getSetting('locale'), getSetting('alertSound')
    ]);
    if (consent) registerAppShell();
    $('soundToggle').checked = soundSetting !== false;
    attention.setSound($('soundToggle').checked);
    setLanguage(savedLocale || preferredLanguage());
    if (consent && existing?.id && existing?.alias) {
      identity = existing;
      if (!identity.handle) {
        identity.handle = `user${identity.id.slice(0, 8).toLowerCase().replace(/[^a-z0-9]/g, '0')}`;
        await putSetting('identity', identity);
      }
    }
    if (identity) {
      await initializeDeviceKey();
      rooms = normalizeRooms(await getSetting('rooms'));
      if (!rooms.length) { const previous = await getSetting('lastRoom'); if (previous?.roomId) rooms = [previous]; }
      backgroundTimer = setInterval(() => { void pollOtherRooms(); }, 12000);
      presenceTimer = setInterval(() => { void pulsePresence(); }, 24000);
      void pollOtherRooms();
    }
    presenceEnabled = await getSetting('presenceEnabled') === true;
    $('presenceToggle').checked = presenceEnabled;
    if (pendingInvite || malformedInvite) showInvitation();
    else if (identity && new URLSearchParams(location.search).has('resume')) {
      const previous = await getSetting('lastRoom');
      history.replaceState(null, '', location.pathname);
      if (previous) { try { await openRoom(previous); } catch { showLobby(); } }
      else showLobby();
    }
    else if (identity) showLobby();
    else screen('onboarding');
  } catch (error) { screen('onboarding'); $('startBtn').disabled = true; toast(`${t('unsupported')}: ${error.message}`); }
})();
