"""Optional local browser smoke test (requires playwright + system chromium)."""
import os
import subprocess
import tempfile
import time
import urllib.request
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
            a = browser.new_context(permissions=['clipboard-read','clipboard-write'],viewport={'width':390,'height':844})
            b = browser.new_context(permissions=['clipboard-read','clipboard-write'],viewport={'width':390,'height':844})
            pagea=a.new_page(); pageb=b.new_page()
            for page, name in [(pagea,'Alex'),(pageb,'Yuki')]:
                page.goto(f'http://127.0.0.1:{PORT}/')
                page.locator('#nickname').fill(name)
                page.locator('#ack').check()
                page.locator('#startBtn').click()
                page.locator('#lobby').wait_for(state='visible')
            pagea.locator('#createBtn').click()
            pagea.locator('#chat').wait_for(state='visible')
            pagea.locator('#shareBtn').click()
            invite = pagea.evaluate('navigator.clipboard.readText()')
            assert invite.startswith('http://127.0.0.1:18787/#invite='), invite
            pageb.goto(invite)
            pageb.locator('#pendingInvite').wait_for(state='visible')
            pageb.locator('#joinBtn').click()
            pageb.locator('#chat').wait_for(state='visible')
            pagea.locator('#messageInput').fill('こんにちは！')
            pagea.locator('#sendBtn').click()
            pageb.locator('.bodytext').filter(has_text='こんにちは！').wait_for(timeout=10000)
            pageb.locator('#chatHeaderBtn').click()
            pageb.locator('#romajiToggle').check()
            pageb.locator('.romanized').filter(has_text='konnichiha').wait_for(timeout=10000)
            pageb.locator('#messageInput').fill('Hi from another browser')
            pageb.locator('#messageInput').press('Enter')
            pagea.locator('.bodytext').filter(has_text='Hi from another browser').wait_for(timeout=10000)
            pagea.screenshot(path='/mnt/data/koncha-chat-preview.png',full_page=True)
            assert pagea.locator('.bubble').count()==2
            print('PASS: two isolated browser profiles exchanged encrypted test messages and romaji is displayed')
            browser.close()
    finally:
        p.terminate(); p.wait(timeout=5)
