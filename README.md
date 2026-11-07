# Koncha · private intercultural messenger (prototype)

**Version:** 0.1.0-alpha.1 · **Status:** experimental, unaudited, not for production or confidential messages.

Koncha is a from-scratch proof of concept for two-device messaging in a mobile web app. It is inspired by *publicly documented ideas* such as out-of-band invitations and untrusted relays; **it is not a fork of SimpleX and does not implement the SimpleX SMP protocol**.

## Included now

- Responsive PWA-oriented web interface (works on Android, iPhone, desktop over HTTPS).
- Explicit first-run storage/privacy/security onboarding and local-only display name.
- No account, phone number, email, contact upload, analytics or tracking.
- Create/join private experimental room via 256-bit secret in invite URL fragment.
- Two-device text messaging with browser-side AES-256-GCM envelopes and an authenticated PHP relay.
- Client-side IndexedDB for room keys and cached encrypted messages; relay stores ciphertext only.
- Optional kana-to-romaji reading aid (does **not** interpret kanji and is not a translation engine).
- Reset local data control, PHP relay with simple per-room file persistence and expiry on activity.
- Unit/integration tests using Node's built-in test runner; no external runtime dependencies.

**WARNING:** This is an **experimental encryption demonstration**, not audited end-to-end secure communication. Anyone with the full invite link can read and impersonate either party. There is no identity verification, ratchet, forward secrecy, message replay defense, secure recovery or protection from a compromised code-delivery server. Read [docs/SECURITY.md](docs/SECURITY.md).

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

## Language goals (not implemented)

- DE / EN / JA interface and translation choices.
- Furigana (requires reliable kanji readings), optional romaji, Japanese politeness guidance.
- Local/offline translation by default; cloud AI only with explicit, per-feature consent and safeguards.

## Legal notes

The original code currently carries an **all-rights-reserved** notice pending a deliberate licensing decision. Do not assume that a public GitHub repository automatically grants a permissive license. The project references published SimpleX specs without copying SimpleX code or protected app assets. See [LICENSE.md](LICENSE.md) and [docs/DEPENDENCIES.md](docs/DEPENDENCIES.md).

For a later visibility change: GitHub repository → Settings → General → Danger Zone → Change repository visibility. The connected ChatGPT GitHub app cannot perform this administrative action.
