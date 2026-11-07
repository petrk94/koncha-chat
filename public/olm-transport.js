/**
 * New-room, one-to-one Olm Double-Ratchet transport.
 *
 * Only vodozemac does key agreement, encryption, authentication and ratchets.
 * The existing shared room secret is retained exclusively for relay auth,
 * invite encapsulation and the optional one-time handshake proof. It NEVER
 * encrypts v2 chat messages. v1 rooms are explicitly legacy and never upgraded
 * silently. A malicious relay can still withhold/delay/reorder messages;
 * users must compare the peer safety fingerprint out of band.
 */
import { createRoom, randomId, b64uDecode, b64uEncode } from './crypto.js';
import { validDevicePublicKey } from './identity.js';
import {
  withOlmLock, readOlmState, createOlmState, commitOlmState,
  hasOlmMessage, getOlmHistory, getOlmOutbox, ackOlmOutbox
} from './olm-store.js';

export const OLM_PROTOCOL = 'koncha-olm-v1';
const enc=new TextEncoder();
let runtimePromise=null;
const validCurve = s => typeof s==='string' && /^[A-Za-z0-9+/]{42}[A-Za-z0-9+/=]{1,2}$/.test(s) && s.length>=43 && s.length<=44;
function parseJSON(text){
  if(typeof text!=='string'||text.length>12000)throw new Error('Invalid Olm envelope');
  return JSON.parse(text);
}
function assertOlmRoom(room){
  if(room?.protocol!==OLM_PROTOCOL || !room?.roomId || !room?.secret)throw new Error('Not an Olm conversation');
}
export const isOlmRoom = room => room?.protocol===OLM_PROTOCOL;
export async function olmRuntime(){
  if(!globalThis.isSecureContext)throw new Error('Olm requires HTTPS or localhost');
  if(!runtimePromise)runtimePromise=import('/vendor/olm/koncha_olm.js').then(async module=>{
    await module.default();
    if(!module.create_account||!module.open_message)throw new Error('Incomplete Olm runtime');
    return module;
  }).catch(error=>{runtimePromise=null;throw new Error('Secure Olm WASM runtime unavailable: '+error.message);});
  return runtimePromise;
}
function publicInviteReady(olm){
  return !!(olm && validCurve(olm.curve) && validCurve(olm.oneTimeKey) && validCurve(olm.ed));
}
function envelope(curve, olm){
  if(!validCurve(curve)||!olm||!([0,1].includes(olm.type))||typeof olm.body!=='string')throw new Error('Invalid Olm ciphertext');
  return {v:2,id:crypto.randomUUID(),senderCurve:curve,olm};
}
async function proof(room, from, to, senderId){
  const master=await crypto.subtle.importKey('raw',b64uDecode(room.secret),{name:'HMAC',hash:'SHA-256'},false,['sign','verify']);
  const msg=enc.encode(JSON.stringify(['koncha-olm-v1/hello',room.roomId,from,to,senderId]));
  return b64uEncode(new Uint8Array(await crypto.subtle.sign('HMAC',master,msg)));
}
async function verifyProof(room,payload){
  if(typeof payload?.proof!=='string')return false;
  const expected=await proof(room,payload.senderCurve,payload.inviterCurve,payload.senderId);
  // Constant time comparison happens inside Web Crypto, not JS string equality.
  const key=await crypto.subtle.importKey('raw',b64uDecode(room.secret),{name:'HMAC',hash:'SHA-256'},false,['verify']);
  const data=enc.encode(JSON.stringify(['koncha-olm-v1/hello',room.roomId,payload.senderCurve,payload.inviterCurve,payload.senderId]));
  return crypto.subtle.verify('HMAC',key,b64uDecode(payload.proof),data) && expected.length===payload.proof.length;
}
function profile(identity){
  if(!identity?.id || !validDevicePublicKey(identity.publicKey))throw new Error('Missing verified local signing identity');
  return {sender:identity.alias,senderHandle:identity.handle,senderId:identity.id,publicKey:identity.publicKey,presenceId:identity.presenceId||''};
}
function basePayload(room,identity,type,text=''){
  return {v:1,type,roomId:room.roomId,...profile(identity),
    ts:Date.now(),nonce:randomId(16),text};
}
function peerFromPayload(payload,curve){
  if(!payload || typeof payload.sender!=='string'||payload.sender.length>32 ||
    typeof payload.senderId!=='string'||payload.senderId.length>96 ||
    typeof payload.senderHandle!=='string'||payload.senderHandle.length>24 ||
    !validDevicePublicKey(payload.publicKey)||!validCurve(curve))throw new Error('Invalid encrypted device identity');
  return {alias:payload.sender,handle:payload.senderHandle,publicKey:payload.publicKey,
    presenceId:payload.presenceId||'',senderId:payload.senderId,olmCurve:curve,verified:false};
}
function samePublic(a,b){
  return validDevicePublicKey(a)&&validDevicePublicKey(b)&&a.x===b.x&&a.y===b.y;
}
export async function createSecureRoom(){
  const wasm=await olmRuntime();
  const room={...createRoom(),requireSignatures:true,protocol:OLM_PROTOCOL};
  const first=parseJSON(wasm.create_account());
  const ready=parseJSON(wasm.generate_prekey(JSON.stringify(first.account)));
  room.olmInvitation={curve:ready.curve,ed:ready.ed,oneTimeKey:ready.oneTimeKey};
  await withOlmLock(room.roomId,async()=>createOlmState(room.roomId,{
    role:'inviter',account:JSON.stringify(ready.account),session:null,
    ownCurve:ready.curve,ownEd:ready.ed,peerCurve:null,peerId:null
  }));
  return room;
}
export async function rotateSecureInvite(room){
  assertOlmRoom(room);
  const wasm=await olmRuntime();
  return withOlmLock(room.roomId,async()=>{
    const state=await readOlmState(room.roomId);
    if(!state||state.role!=='inviter'||state.session)throw new Error('Room already joined or secure state missing');
    const ready=parseJSON(wasm.generate_prekey(state.account));
    const next={...state,account:JSON.stringify(ready.account)};
    delete next.revision;
    await commitOlmState(room.roomId,state.revision,next);
    room.olmInvitation={curve:ready.curve,ed:ready.ed,oneTimeKey:ready.oneTimeKey};
    return room;
  });
}
export async function acceptSecureInvite(room,identity){
  assertOlmRoom(room);
  if(!publicInviteReady(room.olmInvitation))throw new Error('Secure invitation has no signed device key and prekey');
  const wasm=await olmRuntime();
  return withOlmLock(room.roomId,async()=>{
    if(await readOlmState(room.roomId))throw new Error('Secure room already exists on this device');
    const account=parseJSON(wasm.create_account());
    const payload={...basePayload(room,identity,'hello'),senderCurve:account.curve,
      inviterCurve:room.olmInvitation.curve};
    payload.proof=await proof(room,account.curve,room.olmInvitation.curve,payload.senderId);
    const started=parseJSON(wasm.start_outbound(JSON.stringify(account.account),room.olmInvitation.curve,
      room.olmInvitation.oneTimeKey,JSON.stringify(payload)));
    const pending=envelope(account.curve,started.message);
    await createOlmState(room.roomId,{
      role:'joiner',account:JSON.stringify(account.account),session:JSON.stringify(started.session),
      ownCurve:account.curve,ownEd:account.ed,peerCurve:room.olmInvitation.curve,peerId:null
    },{envelope:pending,payload});
    // The invite's encrypted identity is pinned before accepting the first ACK.
    room.peer={...(room.peer||{}),olmCurve:room.olmInvitation.curve,olmEd:room.olmInvitation.ed,verified:false};
    return pending;
  });
}
function validateMessage(room,state,payload,fromCurve){
  if(!payload||payload.v!==1 || payload.roomId!==room.roomId||
    !['hello','hello_ack','chat'].includes(payload.type)||!validCurve(fromCurve)||
    typeof payload.ts!=='number'||!Number.isFinite(payload.ts)||
    typeof payload.nonce!=='string'||!/^[A-Za-z0-9_-]{16,64}$/.test(payload.nonce)||
    typeof payload.text!=='string'||payload.text.length>2000)throw new Error('Invalid ratchet plaintext');
  const peer=peerFromPayload(payload,fromCurve);
  if(state.peerCurve && state.peerCurve!==fromCurve)throw new Error('Olm identity key has changed');
  if(state.peerId && state.peerId!==payload.senderId)throw new Error('Olm device identifier has changed');
  if(room.peer?.publicKey&&!samePublic(room.peer.publicKey,payload.publicKey))throw new Error('Pinned signing identity changed');
  if(room.peer?.olmCurve && room.peer.olmCurve!==fromCurve)throw new Error('Pinned Olm key changed');
  return peer;
}
export async function receiveSecureEnvelope(room,env){
  assertOlmRoom(room);
  if(env?.v!==2||!validCurve(env.senderCurve)||!env.olm || ![0,1].includes(env.olm.type))throw new Error('Refusing legacy/invalid ciphertext in Olm room');
  const wasm=await olmRuntime();
  return withOlmLock(room.roomId,async()=>{
    if(await hasOlmMessage(room.roomId,env.id))return {fresh:false};
    const current=await readOlmState(room.roomId);
    if(!current)throw new Error('Missing secure session – restore is impossible without original browser keys');
    let payload, updatedAccount=current.account, updatedSession, peer, handshaken=false;
    if(!current.session){
      if(current.role!=='inviter'||env.olm.type!==0)throw new Error('Olm handshake required');
      const result=parseJSON(wasm.accept_inbound(current.account,env.senderCurve,JSON.stringify(env.olm)));
      payload=parseJSON(result.text);
      if(payload.type!=='hello'||payload.inviterCurve!==current.ownCurve||
        payload.senderCurve!==env.senderCurve||!await verifyProof(room,payload))throw new Error('Invitation proof invalid');
      peer=validateMessage(room,current,payload,env.senderCurve);
      updatedAccount=JSON.stringify(result.account);updatedSession=JSON.stringify(result.session);
      handshaken=true;
    } else {
      if(current.peerCurve!==env.senderCurve)throw new Error('Olm sender key substitution rejected');
      const result=parseJSON(wasm.open_message(current.session,JSON.stringify(env.olm)));
      payload=parseJSON(result.text);
      peer=validateMessage(room,current,payload,env.senderCurve);
      updatedSession=JSON.stringify(result.session);
      if(payload.type==='hello')throw new Error('Unexpected second Olm handshake');
    }
    const next={...current,account:updatedAccount,session:updatedSession,
      peerCurve:env.senderCurve,peerId:peer.senderId};
    delete next.revision;
    await commitOlmState(room.roomId,current.revision,next,{envelope:env,payload});
    return {fresh:true,type:payload.type,payload,peer,handshaken};
  });
}
export async function sendSecureMessage(room,identity,text,type='chat'){
  assertOlmRoom(room);
  if(!['chat','hello_ack'].includes(type)||typeof text!=='string'||text.length>2000)throw new Error('Invalid secure message');
  const wasm=await olmRuntime();
  return withOlmLock(room.roomId,async()=>{
    const current=await readOlmState(room.roomId);
    if(!current?.session)throw new Error('Waiting for encrypted peer handshake');
    if(type==='chat' && !current.peerCurve)throw new Error('Peer session not yet pinned');
    const payload=basePayload(room,identity,type,text);
    const advanced=parseJSON(wasm.seal_message(current.session,JSON.stringify(payload)));
    const pending=envelope(current.ownCurve,advanced.message);
    const next={...current,session:JSON.stringify(advanced.session)};
    delete next.revision;
    // Ratchet state and exact outgoing envelope are committed BEFORE HTTP send.
    await commitOlmState(room.roomId,current.revision,next,{envelope:pending,payload,queue:true});
    return {envelope:pending,payload};
  });
}
export async function retrySecureOutbox(room,send){
  assertOlmRoom(room);
  for(const pending of await getOlmOutbox(room.roomId)){
    await send(pending); // senderPresenceId supplied by caller
    await ackOlmOutbox(room.roomId,pending.id);
  }
}
export async function visibleSecureMessages(room){
  assertOlmRoom(room);
  return (await getOlmHistory(room.roomId))
    .filter(x=>x.payload?.type==='chat')
    .map(x=>({id:x.id,...x.payload}));
}
export async function secureMessageExists(room,id){
  return hasOlmMessage(room.roomId,id);
}
export async function localOlmFingerprint(curve,ed=''){
  if(!validCurve(curve))throw new Error('Invalid identity for fingerprint');
  const data=enc.encode(JSON.stringify(['Koncha/Olm-identity/v1',curve,ed]));
  const bytes=new Uint8Array(await crypto.subtle.digest('SHA-256',data));
  let value=0,bits=0,str='';
  const alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  for(const byte of bytes){
    value=(value<<8)|byte;bits+=8;
    while(bits>=5){str+=alphabet[(value>>>(bits-=5))&31];}
  }
  if(bits)str+=alphabet[(value<<(5-bits))&31];
  return str.match(/.{1,4}/g).join('-');
}
export async function ownSecureFingerprint(room){
  const current=await readOlmState(room.roomId);
  return current?localOlmFingerprint(current.ownCurve,current.ownEd):'—';
}
