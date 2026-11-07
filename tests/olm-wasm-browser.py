"""Exercise the actual vodozemac wasm-bindgen Olm Double Ratchet in Chromium.
No mocked crypto. Run after 'npm run crypto:build'. No real chat content.
"""
from pathlib import Path
import os, subprocess, tempfile, urllib.request, time
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[1]
PORT=18791
URL=f'http://127.0.0.1:{PORT}/'
with tempfile.TemporaryDirectory(prefix='koncha-olm-') as tmp:
    proc=subprocess.Popen(['php','-S',f'127.0.0.1:{PORT}','-t','public'],cwd=ROOT,env={**os.environ,'KONCHA_DATA_DIR':tmp},stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
    try:
        for _ in range(60):
            try:
                urllib.request.urlopen(URL,timeout=1)
                break
            except Exception: time.sleep(.15)
        else: raise RuntimeError('PHP server unavailable')
        with sync_playwright() as pw:
            browser=pw.chromium.launch(headless=True,args=['--no-sandbox'])
            try:
                page=browser.new_page()
                page.goto(URL,wait_until='domcontentloaded')
                value=page.evaluate("""async () => {
                  const wasm = await import('/vendor/olm/koncha_olm.js');
                  await wasm.default();
                  const alice = JSON.parse(wasm.create_account());
                  const bob = JSON.parse(wasm.create_account());
                  const aliceReady = JSON.parse(wasm.generate_prekey(JSON.stringify(alice.account)));
                  const outgoing = JSON.parse(wasm.start_outbound(JSON.stringify(bob.account), aliceReady.curve, aliceReady.oneTimeKey, 'Hallo, Olm!'));
                  const incoming = JSON.parse(wasm.accept_inbound(JSON.stringify(aliceReady.account), bob.curve, JSON.stringify(outgoing.message)));
                  if (incoming.text !== 'Hallo, Olm!') throw new Error('Prekey decrypted wrong');
                  const ack = JSON.parse(wasm.seal_message(JSON.stringify(incoming.session), 'こんにちは、ボブ。'));
                  const receivedAck = JSON.parse(wasm.open_message(JSON.stringify(outgoing.session), JSON.stringify(ack.message)));
                  if (receivedAck.text !== 'こんにちは、ボブ。') throw new Error('Ack decrypted wrong');
                  const followup = JSON.parse(wasm.seal_message(JSON.stringify(receivedAck.session), 'History secrecy test'));
                  const received = JSON.parse(wasm.open_message(JSON.stringify(ack.session), JSON.stringify(followup.message)));
                  if (received.text !== 'History secrecy test') throw new Error('Ratchet failed');
                  let tampered=false;
                  const corrupt={...followup.message,body:'A'+followup.message.body.slice(1)};
                  try { wasm.open_message(JSON.stringify(ack.session), JSON.stringify(corrupt)); } catch { tampered=true; }
                  if (!tampered) throw new Error('Tampering accepted');
                  // vodozemac pickle round trip: a new instance can continue ratchet.
                  const returnMessage=JSON.parse(wasm.seal_message(JSON.stringify(received.session), 'Resume after restart'));
                  const resumed=JSON.parse(wasm.open_message(JSON.stringify(followup.session),JSON.stringify(returnMessage.message)));
                  if (resumed.text !== 'Resume after restart') throw new Error('Pickle restart failed');
                  return {interoperability:true, tamperRejected:true, sessionRestore:true};
                }""")
                assert value == {'interoperability':True,'tamperRejected':True,'sessionRestore':True}, value
                print('PASS: actual vodozemac WASM Olm handshake, bidirectional ratchet, tamper rejection and pickle restore')
            finally: browser.close()
    finally: proc.terminate();proc.wait(timeout=5)
