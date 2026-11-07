# Koncha — chronological roadmap

- **0.1**: two-browser encrypted prototype (done)
- **0.2**: expiring invitations, multilingual UI (done, merged PR #1)
- **0.3**: chat-first redesign, personal invitations (included in 0.4 PR #2)
- **0.4**: notifications while running, workspace guide (done, merged PR #2)
- **0.5-alpha**: per-browser signing identity and fingerprints, multi-contact rooms, opt-in ephemeral presence, seven-day ciphertext mailbox, browser-local AI capability probe, and PWA test matrix (**in new feature branch; tests are not an audit**)
- **Security beta milestone**: select vetted browser-compatible audited E2EE protocol with forward secrecy, secure invite authentication and device recovery; robust relay quotas and abuse prevention (open)
- **Translation milestone**: license-reviewed self-hosted on-device WASM/WebGPU translation model for iOS/Android/Safari/Firefox, guarded download, local cache controls and model quality tests (open)
- **Closed-PWA push milestone**: opt-in Web Push with VAPID, endpoint lifecycle, privacy metadata review and iOS/Android physical tests (open)
- **Release milestone**: device matrix, accessibility, independent security audit, compliance and no unverified security claims (open)

Read `docs/SECURITY_0_5.md`, `docs/PWA_DEVICE_TESTS.md` and `docs/LOCAL_TRANSLATION.md` for the exact implementation boundaries.


## 0.7 alpha update

- [x] Server/client Web Push transport with VAPID JWT and **empty** notification payloads, off by default; acceptance on real push providers is pending.
- [x] ONNX model checksum/manifest verification tool, test failures on corrupted assets.
- [x] Continuous automated test workflow.
- [ ] Independent protocol integration + forward secrecy with verified identity/session binding; not yet ready.
- [ ] Real on-device ONNX inference and model license/quality sign-off.
- [ ] iPhone and Android install, offline and closed-app notification tests on physical hardware.
