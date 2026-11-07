"""Real PHP + two-browser Olm flow. Not a production security audit.
Requires 'npm run crypto:build', python playwright and installed Chromium.
All test identities and messages are fabricated.
"""
import os, subprocess, tempfile, time, urllib.request
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[1]
PORT=18792
BASE=f'http://127.0.0.1:{PORT}/'
def wait_js(page,expression,argument=None,timeout=30000):
    deadline=time.monotonic()+timeout/1000
    while time.monotonic()<deadline:
        try:
            if page.evaluate(expression,argument): return
        except Exception: pass
        time.sleep(.2)
    raise AssertionError('Browser condition did not become true: '+expression[:95])

with tempfile.TemporaryDirectory(prefix='koncha-ratchet-http-') as tmp:
    proc=subprocess.Popen(['php','-S',f'127.0.0.1:{PORT}','-t','public'],cwd=ROOT,
        env={**os.environ,'KONCHA_DATA_DIR':tmp},stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
    try:
        for _ in range(70):
            try:
                urllib.request.urlopen(BASE,timeout=1);break
            except Exception:time.sleep(.15)
        else:raise RuntimeError('PHP relay did not start')
        with sync_playwright() as pw:
            browser=pw.chromium.launch(headless=True,args=['--no-sandbox'])
            try:
                ca=browser.new_context(permissions=['clipboard-read','clipboard-write'],viewport={'width':1280,'height':780})
                cb=browser.new_context(permissions=['clipboard-read','clipboard-write'],viewport={'width':400,'height':800})
                a=ca.new_page();b=cb.new_page()
                a.goto(BASE)
                a.locator('#nickname').fill('Alex Secure')
                a.locator('#handle').fill('alex.secure')
                a.locator('#ack').check();a.locator('#startBtn').click()
                a.locator('#lobby').wait_for(state='visible',timeout=25000)
                a.locator('#createBtn').click()
                a.locator('#chat').wait_for(state='visible',timeout=60000)
                a.locator('#settingsBtn').click()
                a.locator('#shareBtn').click()
                wait_js(a,"async () => (await navigator.clipboard.readText()).includes('handle=alex.secure')")
                invitation=a.evaluate('navigator.clipboard.readText()')
                assert 'secret=' not in invitation
                b.goto(invitation)
                b.locator('#invitation').wait_for(state='visible')
                assert b.locator('#inviterName').inner_text() == 'Alex Secure'
                b.locator('#joinBtn').click()
                b.locator('#nickname').fill('Yuki Secure')
                b.locator('#handle').fill('yuki.secure')
                b.locator('#ack').check();b.locator('#startBtn').click()
                b.locator('#chat').wait_for(state='visible',timeout=60000)
                wait_js(a,"() => document.querySelector('#contactName').textContent==='Yuki Secure'",timeout=45000)
                a.locator('#closePreferences').click()
                b.locator('#messageInput').fill('こんにちは。Olm ラチェットです。')
                b.locator('#sendBtn').click()
                a.locator('.bodytext').filter(has_text='こんにちは。Olm').wait_for(timeout=30000)
                a.locator('#messageInput').fill('Hello, forward-secret exchange!')
                a.locator('#sendBtn').click()
                b.locator('.bodytext').filter(has_text='Hello, forward-secret exchange!').wait_for(timeout=30000)

                # Device comparison works across the two encrypted sessions.
                a.locator('#settingsBtn').click()
                b.locator('#settingsBtn').click()
                wait_js(a,"() => document.querySelector('#peerFingerprint').textContent.length > 40")
                wait_js(b,"() => document.querySelector('#deviceFingerprint').textContent.length > 40")
                assert a.locator('#peerFingerprint').inner_text()==b.locator('#deviceFingerprint').inner_text()
                assert b.locator('#peerFingerprint').inner_text()==a.locator('#deviceFingerprint').inner_text()
                a.locator('#closePreferences').click();b.locator('#closePreferences').click()

                # Reload one browser: persisted pickled Olm state MUST decrypt new ciphertext.
                b.reload()
                b.locator('#lobby').wait_for(state='visible')
                b.locator('#savedRooms .saved-row').first.click()
                b.locator('#chat').wait_for(state='visible')
                b.locator('.bodytext').filter(has_text='Hello, forward-secret exchange!').wait_for(timeout=30000)
                a.locator('#messageInput').fill('After browser restart: two-way ratchet persists')
                a.locator('#sendBtn').click()
                b.locator('.bodytext').filter(has_text='After browser restart').wait_for(timeout=30000)

                # An authorized legacy AES envelope inserted into secure room is ignored.
                b.evaluate("""async () => {
                  const [{getSetting},{deriveRoomKeys,encryptPayload}]=await Promise.all([import('/db.js'),import('/crypto.js')]);
                  const room=await getSetting('lastRoom');const keys=await deriveRoomKeys(room);
                  const env=await encryptPayload(keys.messageKey,{
                    text:'injected legacy downgrade attempt',sender:'attacker',senderId:'attacker',ts:Date.now()
                  });
                  const r=await fetch('/api.php?action=send',{method:'POST',headers:{
                    Authorization:'Bearer '+keys.authToken,'Content-Type':'application/json'
                  },body:JSON.stringify({roomId:room.roomId,envelope:env})});
                  if(!r.ok)throw Error('legacy packet could not be submitted to relay');
                }""")
                time.sleep(5)
                assert a.locator('.bodytext').filter(has_text='injected legacy downgrade attempt').count()==0

                # The PHP relay sees only ciphertext, no plaintext message content.
                roomfiles=list(Path(tmp).glob('*.json'))
                assert len(roomfiles)==1,roomfiles
                relay_data=roomfiles[0].read_text()
                assert 'こんにちは' not in relay_data and 'After browser restart' not in relay_data
                assert '"v":2' in relay_data and '"olm"' in relay_data

                print('PASS: two real Chromium profiles: invite/prekey/Olm ratchet, reply, restart, pinned fingerprints, downgrade rejection, ciphertext-only PHP')
            finally:browser.close()
    finally:proc.terminate();proc.wait(timeout=5)
