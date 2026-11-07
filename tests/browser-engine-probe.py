"""Desktop browser-engine PWA smoke. Browser engines ≠ physical iPhone/Android.
This test launches actual Chromium, Firefox and WebKit on a disposable localhost
PHP relay with fabricated data; it never uses production chats or credentials.
"""
import os
import subprocess
import tempfile
import time
import urllib.request
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
PORT = 18788
URL = f"http://127.0.0.1:{PORT}/"

with tempfile.TemporaryDirectory(prefix="koncha-pwa-probe-") as tmp:
    server = subprocess.Popen(
        ["php", "-S", f"127.0.0.1:{PORT}", "-t", "public"],
        cwd=ROOT, env={**os.environ, "KONCHA_DATA_DIR": tmp},
        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try:
        for _ in range(60):
            try:
                urllib.request.urlopen(URL, timeout=1)
                break
            except Exception:
                time.sleep(0.1)
        else:
            raise RuntimeError("PHP test relay failed to start")
        with sync_playwright() as pw:
            for engine in ("chromium", "firefox", "webkit"):
                browser = getattr(pw, engine).launch(headless=True)
                try:
                    context = browser.new_context(viewport={"width":390,"height":844})
                    page = context.new_page()
                    page.goto(URL, wait_until="domcontentloaded", timeout=20000)
                    page.locator("#nickname").wait_for(state="visible", timeout=10000)
                    assert page.locator("#startBtn").count() == 1, engine
                    # Koncha deliberately registers the SW only after storage consent.
                    page.locator("#nickname").fill("Koncha Test")
                    page.locator("#handle").fill("test." + engine)
                    page.locator("#ack").check()
                    page.locator("#startBtn").click()
                    page.locator("#lobby").wait_for(state="visible", timeout=10000)
                    report = page.evaluate("""async () => {
                      if (!('serviceWorker' in navigator)) return { supported:false };
                      await Promise.race([
                        navigator.serviceWorker.ready,
                        new Promise((_,reject) => setTimeout(() => reject(new Error('SW registration timeout')), 12000))
                      ]);
                      let keys = await caches.keys();
                      let shell = keys.find(k => k.startsWith('koncha-shell-'));
                      if (!shell) return { supported:true, cached:false };
                      let cache = await caches.open(shell);
                      return { supported:true, cached:!!(await cache.match('/index.html')),
                        noApi:!(await cache.match('/api.php')), noModel:!(await cache.match('/models/manifest.json')) };
                    }""")
                    assert report.get("supported"), (engine,report)
                    assert report.get("cached"), (engine,report)
                    assert report.get("noApi") and report.get("noModel"), (engine,report)
                    print(f"PASS: {engine} responsive first launch, offline app shell, API not cached")
                    context.close()
                finally:
                    browser.close()
        print("Physical mobile testing and vendor Web Push are NOT covered by this script.")
    finally:
        server.terminate()
        server.wait(timeout=5)
