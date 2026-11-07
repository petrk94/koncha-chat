# Koncha 0.5 — real iPhone / Android test matrix

Use **fabricated messages only**. Run the actual PHP relay under HTTPS with the `public/` directory as the web root and `var/rooms/` entirely outside it. Do not use the PHP development server on a public network.

## Required devices

- [ ] Desktop Chromium (test fresh profile / existing 0.4 IndexedDB migration)
- [ ] Desktop Firefox (test fresh profile and multiroom)
- [ ] iPhone Safari browser tab (HTTPS)
- [ ] iPhone: Share → Add to Home Screen → launch installed PWA
- [ ] Android Chrome browser tab (HTTPS)
- [ ] Android Chrome: Install app / Add to Home Screen → launch PWA

## Test order — each step can be stopped independently

1. [ ] **Compatibility / onboarding**: after creating an identity, check that local signing keys survive refresh. Compare this device's fingerprint after reopening; it must be identical. Clearing site data must result in a new fingerprint (old chats cannot be recovered).
2. [ ] **Multiple conversations**: A invites B. A then creates a completely separate room for C. Verify both conversations remain in the sidebar/lobby, each can be reopened, and their keys/participants are separate. A used invitation must not admit a third person.
3. [ ] **Device verification**: B compares the complete security code displayed in A's settings to the code B sees for A. Mark only on exact match. A should independently confirm B's code; A learns B's public key after B sends a signed message. Negative test: change/corrupt the public key in the encrypted test fixture; message must be rejected.
4. [ ] **Offline message**: close B's tab. A sends a test message, confirms server acceptance, then B opens Koncha later (within seven days) and sees it. This demonstrates temporary ciphertext storage, **not** guaranteed delivery or background push.
5. [ ] **Presence**: enable "share online activity" independently on A and B, keep B's app visible and wait up to 25 seconds. A should see an online indication after B has sent a signed message so its room-specific presence token is known. Close B and verify status changes after about 70 seconds. If permission is off, status must say unknown.
6. [ ] **Browser alerts**: with tab open but hidden, trigger incoming test message; expect unread badge, optional chime and generic OS alert (if user permitted). Foreground/close-tab behavior may be throttled. **Fully closed PWA push is not implemented.**
7. [ ] **Local translation probe**: click "Check local translation". Record whether native Translator API, WebGPU, WASM are available. Try Japanese→German only if the native on-device translator supports the pair; if not, clear unavailable message should appear and original text must stay visible. Do not infer that WebGPU support means a model is installed.
8. [ ] **Privacy check**: browser DevTools Network: ensure message plaintext never enters `/api.php` or translation web service. No cloud translation fallback. Server access logs may contain room ID and IP but not message text.
9. [ ] **Browser restart / storage eviction**: re-launch installed PWA and confirm rooms remain. Test private/incognito mode separately; no persistence guarantee there. iOS may evict cached content.
10. [ ] **Accessibility**: confirm invite can be accepted on a narrow device, JavaScript module loads under HTTPS, Japanese IME Enter selects candidates instead of prematurely sending, settings drawer remains usable with on-screen keyboard.

Record for each test: OS version, browser version, PWA installed/not, date, result, console output (redact room IDs, URLs, keys), and screenshots without message secrets.
