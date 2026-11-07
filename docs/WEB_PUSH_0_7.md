# Web Push in Koncha 0.7: optional controlled test

**Status: functional code + automated protocol tests, but no real push-provider or physical-device delivery test yet. Not production approved.**

## Transport and confidentiality

1. After a direct click on **Web Push für diesen Chat aktivieren**, the browser requests permission and creates a standards-based PushSubscription for the Koncha PWA's Service Worker.
2. The subscription **endpoint** is registered on Koncha's own PHP relay for **one specific room**, using the existing room bearer authentication. A random 16-character per-room device token is used to exclude the sending device from notifications.
3. On a newly stored ciphertext envelope, PHP sends an **empty HTTPS POST** to the subscribed browser vendor's Web Push endpoint with a VAPID JWT. This POST includes **no chat body, sender name, room ID, ciphertext or any encrypted chat content**. It does expose the recipient's Push endpoint, transport metadata, VAPID subject and the time of delivery to the provider.
4. The Service Worker receives an empty push event and displays a generic notification: **Koncha / New message. Open Koncha to read it.** Tapping opens the app, which fetches ciphertext through the regular API and decrypts in the client.
5. Delivery is best effort: no guaranteed delivery, device offline queue, expiration/acknowledgement, E2EE metadata protection or read receipts. Only the encrypted conversation store has a seven-day activity-based TTL. Push service TTL is 60 seconds.

**Privacy compromise:** The browser exposes a subscription endpoint to the PHP server; if the same service worker subscription is registered for several rooms, the server can correlate them. The vendor may link subscriptions by device/network. All user-visible settings remain optional and off by default. This is not as anonymous as a dedicated multi-hop messaging network.

## Server prerequisites

- HTTPS and trusted certificate; PHP >=8.2 with OpenSSL **and cURL extensions**, JSON, filesystem permissions.
- Apache must serve **only** `public/` as document root; `var/rooms/` and the private key must be outside it.
- VAPID signing key must be a P-256 EC PEM readable by PHP but not served or logged. Generate with `bash scripts/generate-vapid.sh` (refuses overwrite).
- Set `KONCHA_VAPID_PRIVATE_KEY_FILE=/absolute/secret/path/vapid-private.pem` and `KONCHA_VAPID_SUBJECT=mailto:YOUR_ADMIN_ADDRESS` in PHP's environment. The mailto address is **included in VAPID JWT** presented to push vendors.
- Keep `public/push-service.php`, `public/api.php`, `public/sw.js` and `public/push-client.js` on the same HTTPS origin. Do **not** set up open CORS or cross-origin credential access.
- The relay will return `enabled:false` from `push_config` when it lacks a valid key/contact or PHP cURL. The browser refuses activation rather than pretending push works.
- Outbound requests are restricted to known Apple, Firefox, FCM and Windows Push vendor domains over HTTPS on the default port. No redirects, explicit network timeouts, TLS certificate validation. More vendors require a deliberate allowlist review.

## Commands (run from existing Git checkout)

```bash
php -m | grep -E 'openssl|curl'
bash scripts/generate-vapid.sh
npm test
# php -S ... is local-only; do not use as an Internet-facing production push server
```

**Never commit** a PEM/key, PHP environment secret, subscription endpoint or chat room file. A client can manually revoke Web Push per room; resetting Koncha attempts to unregister all chats first and warns if the connection is unavailable. Subscriptions are lazily expired after 30 days without refresh or can be removed by `push_unsubscribe`. The server cannot guarantee immediate deletion of already accepted OS push messages. A separate scheduled cleanup and rate limiter are required before public beta.

## Physical acceptance test (not yet passed)

| Case | Steps | Expected |
|---|---|---|
| Desktop Chrome | Open two HTTPS browser profiles; subscribe receiver per chat; close receiver tab; send dummy message | Generic OS notification; tap resumes chat |
| Desktop Firefox | Repeat under Firefox with notifications allowed | Generic notice, original body stays only in encrypted message cache |
| iPhone installed PWA | Safari → Share → Add to Home Screen; open via icon; allow notifications from direct button; close app; send from desktop | Notice on iOS Lock Screen/Notification Center, tapping opens Koncha |
| Android installed PWA | Add to Home Screen in Chrome, allow notifications, close app | Generic notification, open linked app |
| No permission | Deny notifications; send a message | Message still reaches ciphertext mailbox, no push |
| Wrong keys / cURL missing | Remove server VAPID configuration or PHP cURL | UI fails closed with error, messages still send |
| Offline | Turn off device connectivity; send dummy text; reconnect within message TTL | Delivery **not guaranteed**; app can fetch retained ciphertext after reconnect |
| Privacy | Inspect server request and vendor payload in controlled test environment | Endpoint/timing only, **no plaintext, alias, room ID or ciphertext** |
| Removal | Disable per room and reset locally | Server subscription removed if online; warn before loss of keys otherwise |

Record device model, OS, browser, installed mode, test timestamp and outcome. Do not record private chat content, invite links or Push endpoints in screenshots or logs.

References: https://developer.apple.com/documentation/usernotifications/sending-web-push-notifications-in-web-apps-and-browsers ; https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/
