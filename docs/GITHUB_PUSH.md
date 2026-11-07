# Publish the prepared 0.2 branch

The bundled folder contains an initialized Git repository with branch `feat/expiring-invites-mobile-i18n`. The GitHub connector could read `petrk94/koncha-chat` but returned `403 Resource not accessible by integration` for branch/issue creation. Do not claim it was pushed.

After extracting the ZIP archive, run:

```bash
cd koncha-chat
gh auth status
git remote -v
# Existing origin may be absent from the ZIP; only add it if not already configured:
git remote add origin https://github.com/petrk94/koncha-chat.git
git push -u origin feat/expiring-invites-mobile-i18n
gh pr create --repo petrk94/koncha-chat --base main --head feat/expiring-invites-mobile-i18n \
  --title 'Koncha 0.2: one-time invites, multilingual mobile UI and local translation adapter' \
  --body 'Adds 60-minute single-use invite handoff, DE/EN/JA locale UI, chat UX, local-only Translator API adapter, tests and WebGPU/WASM implementation plan. Experimental: no audited E2EE or WebGPU inference model yet.'
```

If `origin` already exists, skip `git remote add origin`. Before merging, inspect the diff and run tests locally.
