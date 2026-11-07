/** Opt-in, room-scoped, standards-based Web Push. No chat plaintext is sent. */
export function decodeVapidPublicKey(encoded) {
  if (typeof encoded !== 'string' || !/^[A-Za-z0-9_-]{87}$/.test(encoded)) throw new Error('Invalid server VAPID public key');
  const raw = atob(encoded.replace(/-/g, '+').replace(/_/g, '/') + '=');
  const bytes = Uint8Array.from(raw, char => char.charCodeAt(0));
  if (bytes.length !== 65 || bytes[0] !== 4) throw new Error('Invalid VAPID P-256 public key');
  return bytes;
}

export function canUsePush(env = globalThis) {
  return Boolean(env.isSecureContext && env.navigator?.serviceWorker && env.PushManager && env.Notification?.requestPermission);
}

export async function subscribeRoomPush({ api, room, keys, env = globalThis } = {}) {
  if (!room?.presenceId || !keys) throw new Error('Open a saved conversation first');
  if (!canUsePush(env)) throw new Error('Web Push unavailable on this device or not installed as a PWA');
  // Permission must be requested from the user's direct click before any awaits.
  const permission = env.Notification.permission === 'default'
    ? env.Notification.requestPermission() : Promise.resolve(env.Notification.permission);
  if (await permission !== 'granted') throw new Error('Notifications permission denied');
  const config = await api('push_config', { contextRoom: room, contextKeys: keys });
  if (!config.enabled || !config.publicKey) throw new Error('Web Push server is not configured');
  const reg = await env.navigator.serviceWorker.ready;
  if (!reg.pushManager) throw new Error('Push manager unavailable');
  let subscription = await reg.pushManager.getSubscription();
  if (!subscription) {
    subscription = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: decodeVapidPublicKey(config.publicKey) });
  }
  await api('push_subscribe', { method: 'POST', contextRoom: room, contextKeys: keys,
    body: { deviceId: room.presenceId, endpoint: subscription.endpoint } });
  return subscription;
}

export async function unsubscribeRoomPush({ api, room, keys, env = globalThis } = {}) {
  if (!room?.presenceId || !keys) return;
  const reg = await env.navigator?.serviceWorker?.ready;
  const subscription = await reg?.pushManager?.getSubscription?.();
  if (!subscription) return;
  await api('push_unsubscribe', { method: 'POST', contextRoom: room, contextKeys: keys,
    body: { deviceId: room.presenceId, endpoint: subscription.endpoint } });
  // Do not unsubscribe the browser-level subscription: another room may use it.
}
