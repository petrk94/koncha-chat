# Koncha · private intercultural messenger (prototype)

**Version:** 0.3.0-alpha.1 · **Status:** experimental, unaudited, not for production or confidential messages.

Koncha is a from-scratch proof of concept for two-device messaging in a mobile web app. It is inspired by *publicly documented ideas* such as out-of-band invitations and untrusted relays; **it is not a fork of SimpleX and does not implement the SimpleX SMP protocol**.

## Version 0.3 — personal invitations and focused chat

- Desktop interface now shows one conversation list and an uncluttered conversation pane; the settings are a dismissible dialog rather than a panel that pushes messages out of view. On phones the list is hidden to maximize message space.
- A new invite URL opens a **dedicated personal invitation screen before onboarding**. It shows the inviter's self-declared display name and local handle, whether or not the recipient has already created an identity. On accept, a new recipient sets up their own local name and handle and automatically joins; declining does not create a room.
- Invitation names/handles are contained in the URL fragment (not sent to the relay as part of HTTP requests), and embedded in the encrypted invitation handoff for a consistency check when redeemed. They are **not proof of identity**; the sender can choose any name, handles are not globally unique, and the relay/protocol cannot verify a human identity. Always compare identity out of band if important. Old 0.2 invitations without a name remain redeemable.
- The existing 60-minute one-time invitation lifecycle, encrypted test messages, client-side translation opt-in, DE/EN/JA languages, Enter sending, and emoji remain.
- **Security remains experimental**: the shared-room-secret design allows impersonation, no forward secrecy/ratchet or verified device identities. Only test with non-sensitive content.

## Included now

- Responsive PWA-oriented web interface (works on Android, iPhone, desktop over HTTPS).
- Explicit first-run storage/privacy/security onboarding and local-only display name.
- No account, phone number, email, contact upload, analytics or tracking.
- One-time invitations valid for 60 minutes. The URL contains a random invite token, **not** the room key; encrypted room-key handoff occurs on the relay. Each newly created link invalidates the previous unused link.
- Two-device text messaging with browser-side AES-256-GCM envelopes and an authenticated PHP relay.
- Client-side IndexedDB for room keys and cached encrypted messages; relay stores ciphertext only.
- Optional kana-to-romaji reading aid (does **not** interpret kanji and is not semantic translation).
- DE/EN/JA UI with browser-language default and manual preference, Enter-to-send (safe for Japanese IME), emoji picker, per-conversation settings behind an overlay.
- Opt-in client-side translation adapter using the browser-native on-device Translator API where supported; Firefox, Safari and mobile browsers need the planned WebGPU/WASM model-worker fallback before translation can be enabled. **No cloud inference.**
- Reset local data control, PHP relay with simple per-room file persistence and expiry on activity; expired invitation handoffs are removed at next access.
- Unit/integration tests using Node's built-in test runner; no external runtime dependencies.

**WARNING:** This is an **experimental encryption demonstration**, not audited end-to-end secure communication. Whoever successfully redeems the invite obtains the shared room key and can impersonate either participant. Expiry or revocation prevents NEW claims only; it does not revoke access to an established chat. There is no verified identity, ratchet, forward secrecy, message replay defense, secure recovery or protection from a compromised code-delivery server. Read [docs/SECURITY.md](docs/SECURITY.md).

## Run locally

Requirements: PHP 8.2+, modern browser. Node 20+ is optional for tests.

```bash
cd koncha-chat
php -S 127.0.0.1:8787 -t public
# open http://127.0.0.1:8787
```

To simulate two devices locally, open the site in **two different browser profiles on the same computer**, with separate IndexedDB storage. Copy an invite from profile A into profile B. To use **two real mobile devices**, deploy through HTTPS on a host reachable by both; `http://192.168.x.x` does not offer a secure context for Web Crypto on many mobile browsers.

```bash
node --test tests/*.test.js
```

## Production deployment? Not yet

For a private controlled demo on your own PHP host, configure the public web root to point at `public/` and leave `var/rooms/` **outside** the document root. Provide HTTPS and review server / reverse-proxy access logs. `public/.htaccess` contains security headers for Apache; other web servers need equivalent configuration.

The built-in PHP web server is development-only. Do not expose it directly to the internet. No automated deletion job exists, so stored data might remain until the next room request. For any public deployment, implement retention enforcement, abuse protection, key/device authentication, reviewed E2EE protocol, independent audit, monitoring without sensitive logs, and a real threat model.

### GitHub repository creation

The GitHub connector available to ChatGPT can update existing repositories, but cannot create a new repository or change its visibility. To publish this scaffold:

1. In GitHub, create a **new empty repository** named `koncha-chat` under your account (`petrk94`). Do not initialize a GitHub README, .gitignore or license, because those files are already included.
2. You asked to start **public** and change to **private** later. This scaffold contains no real keys or messages, so the source can be published, but be aware that anyone can clone it while public; making it private later does not retract copies or forks. For proprietary development, starting private immediately is safer. NEVER commit passwords, API keys or real chats.
3. The downloadable ZIP already contains an initialized Git repository and the initial source commit. Extract it and run:

```bash
cd koncha-chat
git remote add origin git@github.com:petrk94/koncha-chat.git
git push -u origin main
```

If SSH is not configured, use `https://github.com/petrk94/koncha-chat.git` with an appropriate GitHub credential manager.

## Language and local AI development

- DE/EN/JA UI, locale preference and kana-to-romaji are implemented.
- Browser-native local Translator API integration is experimental and explicitly opt-in; not generally available in Firefox/Safari/mobile.
- **Planned, not yet packaged:** a local browser WebGPU/WASM Worker with commercially compatible translation models for DE/EN/JA. No cloud text fallback will be introduced. See [docs/LOCAL_TRANSLATION.md](docs/LOCAL_TRANSLATION.md).
- Furigana (requires reliable kanji readings) and Japanese politeness guidance are planned.

## Legal notes

The original code currently carries an **all-rights-reserved** notice pending a deliberate licensing decision. Do not assume that a public GitHub repository automatically grants a permissive license. The project references published SimpleX specs without copying SimpleX code or protected app assets. See [LICENSE.md](LICENSE.md) and [docs/DEPENDENCIES.md](docs/DEPENDENCIES.md).

For a later visibility change: GitHub repository → Settings → General → Danger Zone → Change repository visibility. The connected ChatGPT GitHub app cannot perform this administrative action.

## Repository nach GitHub veröffentlichen

Der Quellcode liegt bereits mit initialem Commit im Git-Repository. Das mitgelieferte Skript `publish-github.sh` erstellt **explizit ein öffentliches** GitHub-Repository unter `petrk94/koncha-chat` und pusht den aktuellen Commit. Dazu wird auf deinem Rechner `gh` benötigt (Ubuntu/Zorin: `sudo apt install gh`). Einmalig bei GitHub anmelden; danach im entpackten Projekt `./publish-github.sh` ausführen. Es werden weder Zugangsdaten noch Chat-Nachrichten ins Repository eingecheckt. Das Skript bricht bei uncommitteten Änderungen oder einem vorhandenen Ziel-Repository ab.

Wichtiger Hinweis: Ein einmal öffentlich gemachtes Repository kann auch nach späterer Umstellung auf privat bereits kopiert worden sein. Noch ist **keine Produktionssicherheit** gegeben.

## Koncha 0.2: manual acceptance test

1. Use two isolated browser profiles. Open Koncha in each and create a local identity; verify DE/EN/JA locale selection and storage disclosures.
2. In browser A, create a room and click **Create invitation**. Open the copied `#invite=` URL in browser B within 60 minutes; it should show the invitation and then join only when accepted.
3. Reopen the same URL: it should report the invitation was already used. Create another invitation; the previous unredeemed link must stop working. A fresh link lasts 60 minutes.
4. Exchange test text and emojis. Verify Enter sends, Shift+Enter inserts a newline, and Japanese IME candidate confirmation does not send.
5. Click the chat header to open settings; enable kana-to-romaji and change Enter behavior. Test manual language selection.
6. Translation is disabled by default. In browsers without a local Translator API, turning it on should show an explicit unavailable message and **must not send plaintext to the server**.
7. To test real iPhone/Android on separate devices, use HTTPS and not the PHP development server.

The screenshot block is not available to a PWA. Real-device iOS/Android visual and keyboard tests are still pending.
