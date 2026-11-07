import {
  createRoom, createInvite, parseInvite, inviteUrl, tokenVerifier, sealInvite, unsealInvite,
  deriveRoomKeys, encryptPayload, decryptPayload, randomId
} from './crypto.js';
import { romanizeKana } from './romanize.js';
import { getSetting, putSetting, putMessage, getMessages, resetAll } from './db.js';
import { applyLanguage, translate } from './i18n.js';
import { browserTranslation } from './translation.js';

const $ = id => document.getElementById(id);
const sections = ['onboarding', 'lobby', 'invitation', 'chat'];
let pendingInvite = parseInvite(location.hash);
const malformedInvite = location.hash.startsWith('#invite=') && !pendingInvite;
if (location.hash) history.replaceState(null, '', location.pathname + location.search);
let locale = 'de';
let identity = null;
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
  for (const id of ['chatTitle', 'contactName']) $(id).textContent = label;
  for (const id of ['sidebarAvatar', 'headerAvatar']) $(id).textContent = avatarFor(peer?.alias);
  $('contactHandle').textContent = peer?.handle ? '@' + peer.handle : '';
  $('roomSubtitle').textContent = peer?.handle ? '@' + peer.handle : t('chatSubtitle');
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
  if (room) { $('connection').textContent = t('connected'); updateConversation(); void renderMessages(); }
  if (pendingInvite && !$('invitation').hidden) $('inviteDescription').textContent = pendingInvite.sender ? t('inviteFromDescription') : t('invitePageLead');
}
function preferredLanguage() {
  for (const item of navigator.languages || [navigator.language]) {
    const code = String(item).split('-')[0].toLowerCase();
    if (['de', 'en', 'ja'].includes(code)) return code;
  }
  return 'en';
}
async function api(action, { method = 'GET', body = {}, authenticated = true } = {}) {
  const url = new URL('/api.php', location.origin);
  url.searchParams.set('action', action);
  if (method === 'GET') url.searchParams.set('room', room.roomId);
  const headers = {};
  if (authenticated) {
    if (!keys) throw new Error('Missing room keys');
    headers.Authorization = `Bearer ${keys.authToken}`;
  }
  if (method === 'POST') headers['Content-Type'] = 'application/json';
  const response = await fetch(url, {
    method, cache: 'no-store', credentials: 'omit', headers,
    ...(method === 'POST' ? { body: JSON.stringify({ roomId: room?.roomId ?? body.roomId, ...body }) } : {})
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
  clearInterval(pollTimer); pollTimer = null;
  clearInterval(inviteTimer); inviteTimer = null;
  clearInterval(pendingTimer); pendingTimer = null;
  room = null; keys = null; activeInvite = null;
  invitationAccepted = false;
  $('inviteStatus').hidden = true;
  showIdentity();
  screen('lobby');
  getSetting('lastRoom').then(saved => { $('recentRoom').hidden = !saved; }).catch(() => {});
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
  room = next;
  keys = await deriveRoomKeys(room);
  await api('init', { method: 'POST' });
  await putSetting('lastRoom', room);
  lastErrorShown = false;
  activeInvite = null;
  currentMessages = await getMessages(room.roomId);
  updateConversation();
  $('connection').textContent = t('connecting');
  $('chatDeviceId').textContent = identity.id.slice(0, 12) + '…';
  $('inviteStatus').hidden = true;
  screen('chat');
  await restoreChatPreferences();
  await renderMessages();
  await poll();
  pollTimer = setInterval(() => { void poll(); }, 2800);
}
async function poll() {
  if (polling || !room || !keys) return;
  polling = true;
  try {
    const received = await api('list');
    const known = new Set(currentMessages.map(m => m.id));
    let changed = false;
    for (const envelope of received.messages || []) {
      if (known.has(envelope.id)) continue;
      try {
        await decryptPayload(keys.messageKey, envelope);
        await putMessage(room.roomId, envelope);
        currentMessages.push(envelope);
        known.add(envelope.id);
        changed = true;
      } catch { /* Ignore unauthenticated ciphertext. */ }
    }
    if (changed) await renderMessages();
    $('connection').textContent = t('connected');
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
      const data = await decryptPayload(keys.messageKey, envelope);
      displayed.push({ ...data, id: envelope.id });
    } catch { /* Corrupted local data is never displayed. */ }
  }
  if (generation !== translationGeneration) return;
  displayed.sort((a, b) => a.ts - b.ts || a.id.localeCompare(b.id));
  const correspondent = [...displayed].reverse().find(m => m.senderId !== identity.id);
  if (correspondent && (!room.peer || room.peer.alias !== correspondent.sender || (correspondent.senderHandle && room.peer.handle !== correspondent.senderHandle))) {
    room.peer = { alias: correspondent.sender.slice(0, 32), handle: String(correspondent.senderHandle || '').slice(0, 24) };
    updateConversation();
    void putSetting('lastRoom', room);
  }
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
    if (invitationAccepted && pendingInvite) await claimPendingInvite();
    else showLobby();
  } catch (error) { toast(`${t('localError')}: ${error.message}`); }
});
$('createBtn').addEventListener('click', async () => {
  try { await openRoom(createRoom()); } catch (error) { showLobby(); toast(`${t('roomError')}: ${error.message}`); }
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
$('roomRow').addEventListener('click', () => closePreferences());
$('resumeBtn').addEventListener('click', async () => {
  try { const previous = await getSetting('lastRoom'); if (previous) await openRoom(previous); }
  catch (error) { showLobby(); toast(`${t('roomError')}: ${error.message}`); }
});
$('shareBtn').addEventListener('click', async () => {
  $('shareBtn').disabled = true;
  try { await makeInvite(); } catch (error) { toast(`${t('invitationError')}: ${error.message}`); }
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
    const envelope = await encryptPayload(keys.messageKey, { text, sender: identity.alias, senderHandle: identity.handle, senderId: identity.id, ts: Date.now() });
    await api('send', { method: 'POST', body: { envelope } });
    await putMessage(room.roomId, envelope);
    currentMessages.push(envelope); field.value = '';
    await renderMessages();
  } catch (error) { toast(`${t('sendError')}: ${error.message}`); }
  finally { $('sendBtn').disabled = false; field.focus(); }
});
$('resetBtn').addEventListener('click', async () => {
  if (!confirm(t('resetConfirm'))) return;
  clearInterval(pollTimer); clearInterval(inviteTimer); clearInterval(pendingTimer);
  translateSession?.dispose();
  try { await resetAll(); location.replace(location.pathname); }
  catch (error) { toast(`${t('resetError')}: ${error.message}`); }
});

(async () => {
  try {
    if (!globalThis.crypto?.subtle || !globalThis.indexedDB) throw new Error(t('unsupported'));
    const [consent, existing, savedLocale] = await Promise.all([
      getSetting('consent'), getSetting('identity'), getSetting('locale')
    ]);
    setLanguage(savedLocale || preferredLanguage());
    if (consent && existing?.id && existing?.alias) {
      identity = existing;
      if (!identity.handle) {
        identity.handle = `user${identity.id.slice(0, 8).toLowerCase().replace(/[^a-z0-9]/g, '0')}`;
        await putSetting('identity', identity);
      }
    }
    if (pendingInvite || malformedInvite) showInvitation();
    else if (identity) showLobby();
    else screen('onboarding');
  } catch (error) { screen('onboarding'); $('startBtn').disabled = true; toast(`${t('unsupported')}: ${error.message}`); }
})();
