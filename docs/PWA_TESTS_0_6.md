> **Version note:** This document describes **0.6**, before Web Push existed. For opt-in 0.7 Web Push, see `docs/WEB_PUSH_0_7.md`. Real device tests remain pending.

# Koncha 0.6 – incremental PWA acceptance tests (manual, real devices outstanding)

Deploy over HTTPS with `public/` as the only document root and `var/rooms/` outside it. Use invented messages; it is NOT approved for confidential communication.

## Phase A – browser feature report (implemented)

In chat settings, choose **PWA-Gerätetest → Gerät prüfen**. Record secure context, online mode, standalone install detection, service worker, Push API, notification permission, IndexedDB, WASM and WebGPU. This report checks API presence, **not the success of a push subscription or a model translation**.

## Phase B – offline app shell (implemented, no offline sending)

1. Open Koncha online, let the service worker install, then refresh once for control to take effect.
2. Open DevTools Application → Service Workers and Cache Storage; look for `koncha-shell-v0.6.0-alpha.1`. Only the app's static source should be there – **never `/api.php`, messages or room secrets**.
3. Create chat A/B and exchange dummy text while online. Disconnect B's network and reopen a *previously saved* room. Local encrypted history should be readable after the app starts offline; new sends fail and stay in the textarea. This is not an offline send queue or delivery guarantee.
4. Reconnect, refresh, and verify normal remote sync. Disable the connection again and open Koncha as an installed PWA from the home screen.
5. Change version/build, reload online, and verify old `koncha-shell-*` caches are cleaned and no outdated shell is kept indefinitely.

## Phase C – notifications (running tab only)

1. Hide an open tab; send test text from the other browser. Verify tone, favicon count and generic OS notice after permission was explicitly granted.
2. Close the tab or PWA entirely: **no background push exists yet**. A visible PushManager in the diagnostics is only platform support; it is *not* a subscription.
3. iOS 16.4+ requires a Home Screen web app for Web Push. Real push needs VAPID, endpoint registration, server-side authenticated routing and a push-event handler, none of which are part of 0.6.
4. Notifications contain no sender name, room ID, ciphertext or plaintext.

## Phase D – physical matrix

- [ ] Linux Chromium, tab and install
- [ ] Linux Firefox, tab (standard manifest installation not supported)
- [ ] iPhone Safari tab, HTTPS
- [ ] iPhone Home Screen PWA, HTTPS
- [ ] Android Chrome tab, HTTPS
- [ ] Android installed PWA, HTTPS

For each record OS, browser, device RAM, installed state, consent prompts, first install, offline cold-open, reconnected sync, notifications, model size and errors. Record no real room IDs or invite URLs in screenshots/logs.
