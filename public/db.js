const DB_NAME = 'koncha-prototype';
const STORE = 'settings';
const MESSAGES = 'messages';
let dbPromise;
function open() {
  if (!dbPromise) dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE);
      req.result.createObjectStore(MESSAGES, { keyPath: 'key' });
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
