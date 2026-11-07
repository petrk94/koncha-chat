# Review notes — 0.3.0-alpha.1

## Changes

- Focused desktop and mobile chat UI; settings and invitation management in right-side overlay, no permanent security panels.
- Invitation-first experience, including before local onboarding; optional self-declared name and handle; participant's name shown after joining.
- Existing 0.2 links remain parseable and redeemable; invitations with self-declared metadata validate consistency against the encrypted handoff on redemption.

## Tests

- `node --test tests/*.test.js` (14 passing automated tests on Node 22 + PHP 8.4).
- `php -l public/api.php` and `node --check public/*.js` passed.
- Static desktop (1280x720), mobile (390x844) and invitation (390x844) screenshots inspected with Playwright and no horizontal overflow observed.
- A full Playwright browser + PHP local integration smoke remains **unverified**: the container's Chromium blocks loopback URLs with `net::ERR_BLOCKED_BY_ADMINISTRATOR`, even with route interception. Run `python3 tests/browser-smoke.py` on a normal local development machine.

## Known limitations

- Self-selected handles are not unique or authenticated; no sender proof, forward secrecy or ratcheting. No secure account recovery.
- Screenshots cannot be blocked in a PWA.
- Client-only translation outside supported browser-native APIs awaits a model worker. No cloud inference is enabled.
- In-progress invite links from 0.2 contain no personal preview; make a new 0.3 invitation to see it.

UI review direction followed principles from [Unslop by Damir Sokolovsky](https://heydamir.design/unslop) (CC BY 4.0); no external assets or UI code were copied.
