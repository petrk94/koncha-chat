/**
 * Durable, locally encrypted Olm state.
 *
 * One per-room Web Lock serializes cryptographic read/advance/write operations.
 * IndexedDB's multi-store transaction atomically advances ratchet state,
 * caches display plaintext (encrypted at rest), and stores outgoing ciphertext
 * for exact retry. No network I/O occurs while an IDB transaction is open.
 *
 * This is not protection from malicious JS served by this origin, XSS or a
 * compromised browser. The wrapping CryptoKey is non-extractable but usable by
 * same-origin scripts. No password-based account recovery is provided.
 */
const NAME = 'koncha-olm-private-v1';
const STATE='state', HISTORY='history', OUTBOX='outbox', META='meta';
const subtle = globalThis.crypto?.subtle;
const enc=new TextEncoder(), dec=new TextDecoder();
let opened=null, keyPromise=null;

function openDB(){
  if(!opened) opened=new Promise((resolve,reject)=>{
    const req=indexedDB.open(NAME,1);
    req.onupgradeneeded=()=>{
      const db=req.result;
      for(const name of [STATE,HISTORY,OUTBOX,META]){
        if(!db.objectStoreNames.contains(name))db.createObjectStore(name,{keyPath:'key'});
      }
    };
    req.onsuccess=()=>resolve(req.result);
    req.onerror=()=>reject(req.error);
    req.onblocked=()=>reject(new Error('Close other Koncha tabs before upgrading secure storage'));
  });
  return opened;
}
function read(db,store,key){
  return new Promise((resolve,reject)=>{
    const req=db.transaction(store).objectStore(store).get(key);
    req.onsuccess=()=>resolve(req.result??null);
    req.onerror=()=>reject(req.error);
  });
}
function transact(db,names,fn){
  return new Promise((resolve,reject)=>{
    const tx=db.transaction(names,'readwrite');
    let result;
    tx.oncomplete=()=>resolve(result);
    tx.onerror=()=>reject(tx.error||new Error('Olm transaction failed'));
    tx.onabort=()=>reject(tx.error||new Error('Olm state conflict'));
    fn(tx,value=>{result=value;});
  });
}
export async function withOlmLock(roomId,callback){
  if(!/^[A-Za-z0-9_-]{24}$/.test(roomId))throw new Error('Invalid Olm room id');
  if(!globalThis.navigator?.locks?.request)throw new Error('Safe session locking unavailable in this browser');
  return navigator.locks.request('koncha-olm:'+roomId,{mode:'exclusive'},callback);
}
async function wrappingKey(){
  if(!keyPromise) keyPromise=(async()=>{
    if(!subtle)throw new Error('WebCrypto is required for ratchet key storage');
    if(!navigator?.locks?.request)throw new Error('Safe key storage locking unavailable');
    return navigator.locks.request('koncha-olm-master',{mode:'exclusive'},async()=>{
      const db=await openDB();
      const existing=await read(db,META,'master');
      if(existing?.value)return existing.value;
      const key=await subtle.generateKey({name:'AES-GCM',length:256},false,['encrypt','decrypt']);
      await transact(db,[META],tx=>tx.objectStore(META).add({key:'master',value:key}));
      return key;
    });
  })().catch(error=>{keyPromise=null;throw error;});
  return keyPromise;
}
function base64(bytes){
  let value='';
  // Never spread an unbounded buffer onto the stack.
  for(let i=0;i<bytes.length;i+=8192)value+=String.fromCharCode(...bytes.subarray(i,i+8192));
  return btoa(value).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
}
function unbase64(text){
  if(!/^[a-zA-Z0-9_-]+$/.test(text||''))throw new Error('Invalid private store envelope');
  const str=atob(text.replace(/-/g,'+').replace(/_/g,'/')+'='.repeat((4-text.length%4)%4));
  return Uint8Array.from(str,c=>c.charCodeAt(0));
}
async function encryptLocal(value){
  const iv=crypto.getRandomValues(new Uint8Array(12));
  const data=enc.encode(JSON.stringify(value));
  const ciphertext=await subtle.encrypt({name:'AES-GCM',iv},await wrappingKey(),data);
  return {iv:base64(iv),ct:base64(new Uint8Array(ciphertext))};
}
async function decryptLocal(sealed){
  if(!sealed?.iv||!sealed?.ct)throw new Error('Invalid locally encrypted state');
  const iv=unbase64(sealed.iv);
  if(iv.length!==12)throw new Error('Invalid local AES nonce');
  const buf=await subtle.decrypt({name:'AES-GCM',iv},await wrappingKey(),unbase64(sealed.ct));
  return JSON.parse(dec.decode(buf));
}
export async function readOlmState(roomId){
  const db=await openDB(),row=await read(db,STATE,roomId);
  if(!row)return null;
  return {revision:row.revision,...await decryptLocal(row.sealed)};
}
export async function createOlmState(roomId,state,{envelope=null,payload=null}={}){
  const db=await openDB();
  const sealed=await encryptLocal(state);
  const h=payload&&envelope?await encryptLocal(payload):null;
  await transact(db,[STATE,HISTORY,OUTBOX],tx=>{
    tx.objectStore(STATE).add({key:roomId,revision:0,sealed});
    if(h)tx.objectStore(HISTORY).add({key:roomId+':'+envelope.id,roomId,id:envelope.id,sealed:h});
    if(envelope)tx.objectStore(OUTBOX).add({key:roomId+':'+envelope.id,roomId,envelope});
  });
}
export async function commitOlmState(roomId,expectedRevision,state,{envelope=null,payload=null,queue=false}={}){
  const db=await openDB();
  const sealed=await encryptLocal(state);
  const cached=payload&&envelope?await encryptLocal(payload):null;
  const key=roomId+':'+(envelope?.id||'');
  await transact(db,[STATE,HISTORY,OUTBOX],(tx)=>{
    const req=tx.objectStore(STATE).get(roomId);
    req.onsuccess=()=>{
      if(!req.result || req.result.revision!==expectedRevision){
        tx.abort();return;
      }
      tx.objectStore(STATE).put({key:roomId,revision:expectedRevision+1,sealed});
      if(cached)tx.objectStore(HISTORY).add({key,roomId,id:envelope.id,sealed:cached});
      if(queue&&envelope)tx.objectStore(OUTBOX).put({key,roomId,envelope});
    };
  });
}
export async function hasOlmMessage(roomId,id){
  const db=await openDB();
  return !!(await read(db,HISTORY,roomId+':'+id));
}
export async function getOlmMessage(roomId,id){
  const db=await openDB(),row=await read(db,HISTORY,roomId+':'+id);
  return row?decryptLocal(row.sealed):null;
}
export async function getOlmHistory(roomId){
  const db=await openDB();
  const rows=await new Promise((resolve,reject)=>{
    const req=db.transaction(HISTORY).objectStore(HISTORY).getAll();
    req.onsuccess=()=>resolve(req.result.filter(r=>r.roomId===roomId));
    req.onerror=()=>reject(req.error);
  });
  return Promise.all(rows.map(async row=>({id:row.id,payload:await decryptLocal(row.sealed)})));
}
export async function getOlmKnownIds(roomId){
  const db=await openDB();
  return new Promise((resolve,reject)=>{
    const req=db.transaction(HISTORY).objectStore(HISTORY).getAllKeys();
    req.onsuccess=()=>resolve(req.result
      .filter(key=>typeof key==='string'&&key.startsWith(roomId+':'))
      .map(key=>key.slice(roomId.length+1)));
    req.onerror=()=>reject(req.error);
  });
}
export async function getOlmOutbox(roomId){
  const db=await openDB();
  return new Promise((resolve,reject)=>{
    const req=db.transaction(OUTBOX).objectStore(OUTBOX).getAll();
    req.onsuccess=()=>resolve(req.result.filter(r=>r.roomId===roomId).map(r=>r.envelope));
    req.onerror=()=>reject(req.error);
  });
}
export async function ackOlmOutbox(roomId,id){
  const db=await openDB();
  await transact(db,[OUTBOX],tx=>tx.objectStore(OUTBOX).delete(roomId+':'+id));
}
export async function clearOlmStore(){
  const db=await openDB();db.close();opened=null;keyPromise=null;
  await new Promise((resolve,reject)=>{
    const req=indexedDB.deleteDatabase(NAME);
    req.onsuccess=resolve;req.onerror=()=>reject(req.error);
    req.onblocked=()=>reject(new Error('Close other open Koncha tabs first'));
  });
}
