# GitHub publishing and source of truth

Current verified merged version: `main` at Koncha 0.2 (PR #1), as checked 2026-11-07. The feature branch in this package includes both the earlier 0.3 UI/invitation changes and the new 0.4 notifications. The GitHub app integration cannot currently write (HTTP 403), so the local branch is not yet uploaded.

Do **not** create a new GitHub repository. Use the single permanent working folder `~/Projekte/koncha-chat` and run:

```bash
./scripts/doctor.sh
npm test
bash scripts/publish-pr.sh
```

`git status -sb` is the correct local repository status command. `gh pr status -R petrk94/koncha-chat` is the GitHub PR status command; `gh status` is invalid. Review the PR and merge when ready. Updating GitHub does not automatically deploy to a PHP server.
