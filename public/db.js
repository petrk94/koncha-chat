const DB_NAME = 'koncha-prototype';
const STORE = 'settings';
const MESSAGES = 'messages';
const NONCES = 'messageNonces';
let dbPromise;
function open() {
  if (!dbPromise) dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 2);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE);
      if (!req.result.objectStoreNames.contains(MESSAGES)) req.result.createObjectStore(MESSAGES, { keyPath: 'key' });
      if (!req.result.objectStoreNames.contains(NONCES)) req.result.createObjectStore(NONCES);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}
export async function getSetting(key) {
  const db = await open();
  return new Promise((resolve, reject) => {
    const req = db.transaction(STORE).objectStore(STORE).get(key);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
export async function putSetting(key, value) {
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(value, key);
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
}
export async function putMessage(roomId, envelope) {
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(MESSAGES, 'readwrite');
    tx.objectStore(MESSAGES).put({ key: `${roomId}:${envelope.id}`, roomId, envelope });
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
}
export async function getMessages(roomId) {
  const db = await open();
  return new Promise((resolve, reject) => {
    const req = db.transaction(MESSAGES).objectStore(MESSAGES).getAll();
    req.onsuccess = () => resolve(req.result.filter(x => x.roomId === roomId).map(x => x.envelope));
    req.onerror = () => reject(req.error);
  });
}
export async function resetAll() {
  // Delete encrypted ratchet state before the legacy database. Lost Olm state
  // cannot be restored from ciphertext stored by the relay.
  const { clearOlmStore } = await import('./olm-store.js');
  await clearOlmStore();
  const db = await open();
  db.close();
  dbPromise = null;
  return new Promise((resolve, reject) => {
    const req = indexedDB.deleteDatabase(DB_NAME);
    req.onsuccess = resolve;
    req.onerror = () => reject(req.error);
    req.onblocked = () => reject(new Error('Close other open Koncha tabs first'));
  });
}

/** One IndexedDB transaction for replay protection and ciphertext persistence.
 * A replayed signed nonce, even with a fresh outer envelope ID, is not stored.
 */
export async function putVerifiedMessage(roomId, envelope, senderId, nonce) {
  if (!roomId || !senderId || !/^[A-Za-z0-9_-]{16,64}$/.test(nonce || '')) throw new Error('Invalid replay identifier');
  const db = await open();
  const key = JSON.stringify([roomId, senderId, nonce]);
  return new Promise((resolve, reject) => {
    const tx = db.transaction([NONCES, MESSAGES], 'readwrite');
    let accepted = false;
    const req = tx.objectStore(NONCES).add(1, key);
    req.onsuccess = () => {
      tx.objectStore(MESSAGES).put({ key: `${roomId}:${envelope.id}`, roomId, envelope });
      accepted = true;
    };
    req.onerror = event => {
      if (req.error?.name === 'ConstraintError') event.preventDefault();
    };
    tx.oncomplete = () => resolve(accepted);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error('IDB transaction aborted'));
  });
}
