"""Optional real browser smoke: invitation first, then local identity, then chat.
Requires Playwright and system Chromium. No production security assumptions.
"""
import os
import subprocess
import tempfile
import time
import urllib.request
import urllib.error
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
PORT = 18787
with tempfile.TemporaryDirectory(prefix='koncha-browser-') as temp:
    p = subprocess.Popen(['php','-S',f'127.0.0.1:{PORT}','-t','public'],cwd=ROOT,env={**os.environ,'KONCHA_DATA_DIR':temp},stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
    try:
        for _ in range(50):
            try:
                urllib.request.urlopen(f'http://127.0.0.1:{PORT}/',timeout=1)
                break
            except Exception:
                time.sleep(.1)
        with sync_playwright() as play:
            browser = play.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--no-proxy-server','--disable-features=LocalNetworkAccessChecks'])
            a = browser.new_context(permissions=['clipboard-read','clipboard-write'],viewport={'width':1280,'height':800})
            b = browser.new_context(permissions=['clipboard-read','clipboard-write'],viewport={'width':390,'height':844})
            # Browser policy may block localhost. Playwright routes requests via Python's HTTP client.
            def forward(route):
                request = route.request
                data = request.post_data_buffer if request.method == 'POST' else None
                headers = {k:v for k,v in request.headers.items() if k.lower() not in ('host','content-length','connection','accept-encoding')}
                req = urllib.request.Request(request.url, data=data, headers=headers, method=request.method)
                try:
                    with urllib.request.urlopen(req, timeout=10) as res:
                        route.fulfill(status=res.status, body=res.read(), headers=dict(res.headers))
                except urllib.error.HTTPError as exc:
                    route.fulfill(status=exc.code, body=exc.read(), headers=dict(exc.headers))
            a.route('**/*', forward); b.route('**/*', forward)
            pagea=a.new_page(); pageb=b.new_page()
            pagea.goto(f'http://127.0.0.1:{PORT}/')
            pagea.locator('#nickname').fill('Alex Becker')
            pagea.locator('#handle').fill('alex.becker')
            pagea.locator('#ack').check()
            pagea.locator('#startBtn').click()
            pagea.locator('#lobby').wait_for(state='visible')
            pagea.locator('#createBtn').click()
            pagea.locator('#chat').wait_for(state='visible')
            pagea.locator('#settingsBtn').click()
            pagea.locator('#chatPreferences').wait_for(state='visible')
            assert pagea.locator('#messages').bounding_box()['height'] > 400, 'Settings must not shrink chat log'
            pagea.locator('#shareBtn').click()
            invite = pagea.evaluate('navigator.clipboard.readText()')
            assert 'from=Alex' in invite and 'handle=alex.becker' in invite
            pageb.goto(invite)
            pageb.locator('#invitation').wait_for(state='visible')
            assert pageb.locator('#inviterName').inner_text() == 'Alex Becker'
            assert pageb.locator('#inviterHandle').inner_text() == '@alex.becker'
            assert not pageb.locator('#lobby').is_visible(), 'Invited party must not see create-room screen'
            pageb.locator('#joinBtn').click()
            pageb.locator('#onboarding').wait_for(state='visible')
            pageb.locator('#nickname').fill('ゆき 田中')
            pageb.locator('#handle').fill('yuki.tanaka')
            pageb.locator('#ack').check()
            pageb.locator('#startBtn').click()
            pageb.locator('#chat').wait_for(state='visible')
            assert pageb.locator('#contactName').inner_text() == 'Alex Becker'
            pagea.locator('#closePreferences').click()
            pagea.locator('#messageInput').fill('こんにちは！')
            pagea.locator('#sendBtn').click()
            pageb.locator('.bodytext').filter(has_text='こんにちは！').wait_for(timeout=10000)
            pageb.locator('#settingsBtn').click()
            pageb.locator('#romajiToggle').check()
            pageb.locator('.romanized').filter(has_text='konnichiha').wait_for(timeout=10000)
            pageb.locator('#closePreferences').click()
            pageb.locator('#messageInput').fill('Hi from another browser')
            pageb.locator('#messageInput').press('Enter')
            pagea.locator('.bodytext').filter(has_text='Hi from another browser').wait_for(timeout=10000)
            assert pagea.locator('#contactName').inner_text() == 'ゆき 田中'
            # Simulate a hidden desktop tab (the browser OS decides actual visibility).
            pagea.evaluate("Object.defineProperty(document, 'hidden', {configurable:true, value:true})")
            pageb.locator('#messageInput').fill('Message while other tab is hidden')
            pageb.locator('#sendBtn').click()
            pagea.wait_for_function("document.title.startsWith('(1)')", timeout=10000)
            assert pagea.locator('link[rel=icon]').get_attribute('href').startswith('data:image/svg+xml,')
            pagea.evaluate("Object.defineProperty(document, 'hidden', {configurable:true, value:false}); document.dispatchEvent(new Event('visibilitychange'))")
            pagea.wait_for_function("!document.title.startsWith('(')", timeout=4000)
            # 0.5 multi-room integration: inviter can open a second independent chat.
            pagea.locator('#leaveBtn').click()
            pagea.locator('#lobby').wait_for(state='visible')
            assert pagea.locator('#savedRooms .saved-row').count() == 1
            pagea.locator('#createBtn').click()
            pagea.locator('#chat').wait_for(state='visible')
            pagea.locator('#settingsBtn').click()
            pagea.locator('#shareBtn').click()
            second_invite = pagea.evaluate('navigator.clipboard.readText()')
            assert second_invite != invite
            pagec_context = browser.new_context(permissions=['clipboard-read','clipboard-write'])
            pagec_context.route('**/*', forward)
            pagec = pagec_context.new_page()
            pagec.goto(second_invite)
            assert pagec.locator('#inviterName').inner_text() == 'Alex Becker'
            pagec.locator('#joinBtn').click()
            pagec.locator('#nickname').fill('Mika Mori')
            pagec.locator('#handle').fill('mika.mori')
            pagec.locator('#ack').check()
            pagec.locator('#startBtn').click()
            pagec.locator('#chat').wait_for(state='visible')
            pagec.locator('#messageInput').fill('Third contact, separate room')
            pagec.locator('#sendBtn').click()
            pagea.locator('#closePreferences').click()
            pagea.locator('.bodytext').filter(has_text='Third contact, separate room').wait_for(timeout=10000)
            pagea.locator('#leaveBtn').click()
            pagea.locator('#lobby').wait_for(state='visible')
            assert pagea.locator('#savedRooms .saved-row').count() == 2
            assert pagea.locator('#savedRooms .saved-row').first.inner_text().strip()

            print('PASS: invitation, signed messages, separate persistent rooms, hidden-tab attention')
            browser.close()
    finally:
        p.terminate(); p.wait(timeout=5)
