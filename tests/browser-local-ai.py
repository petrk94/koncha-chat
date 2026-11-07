"""Actual in-browser, no-cloud ONNX inference against a LOCAL model server.
The test uses a PUBLIC string and runs only after developer/CI provisioning.
Not an iPhone/Android or language-quality test.
"""
import os, subprocess, tempfile, time, urllib.request
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
PORT = 18789
URL = f"http://127.0.0.1:{PORT}/"
with tempfile.TemporaryDirectory(prefix="koncha-browser-ai-") as tmp:
    php = subprocess.Popen(
        ["php","-S",f"127.0.0.1:{PORT}","-t","public"],
        cwd=ROOT,env={**os.environ,"KONCHA_DATA_DIR":tmp},
        stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
    try:
        for _ in range(60):
            try:
                urllib.request.urlopen(URL,timeout=2)
                break
            except Exception:
                time.sleep(.1)
        else:
            raise RuntimeError("Local PHP test server did not start")
        with sync_playwright() as pw:
            browser = pw.chromium.launch(headless=True,args=['--no-sandbox'])
            try:
                page = browser.new_page()
                page.set_default_timeout(180000)
                page.goto(URL,wait_until='domcontentloaded')
                value = page.evaluate("""async () => {
                    const {localWorkerTranslation} = await import('/local-translation.js');
                    const worker = await localWorkerTranslation();
                    try {
                        await worker.prepare('de','en');
                        return await worker.translate('Guten Morgen!','de','en');
                    } finally { worker.dispose(); }
                }""")
                assert isinstance(value,str) and value.strip(), 'Browser model did not translate'
                assert value.strip() != 'Guten Morgen!', 'Browser returned source unchanged'
                print('PASS: real Chrome Web Worker local inference; public source ->',value)
                print('NOT TESTED: Safari/iPhone RAM, Android, quality, reviewed model license')
            finally:
                browser.close()
    finally:
        php.terminate()
        php.wait(timeout=5)
