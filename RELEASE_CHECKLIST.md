# Release Checklist — Rother v0.2.0

## Pre-Release

- [x] `package.json` version is `0.2.0`
- [x] `/api/health` returns version `0.2.0`
- [x] App mode version string is `0.2.0`
- [x] Single package manager (npm) — `bun.lock` removed from tracking
- [x] `CHANGELOG.md` populated
- [x] `RELEASE_NOTES.md` written
- [x] `KNOWN_LIMITATIONS.md` written
- [x] Operational documentation updated (LOCAL_DEVELOPMENT, VERIFICATION_CHECKLIST, ENGINEERING_BASELINE)

## Build Verification

- [ ] `npm test` — all tests pass
- [ ] `npx tsc --noEmit` — zero errors
- [ ] `eslint .` — zero warnings
- [ ] `npm run build` — compiles successfully

## Git

- [ ] All changes committed
- [ ] No build artifacts in working tree
- [ ] `git status` is clean
- [ ] Tag as `v0.2.0`

## Post-Release

- [ ] Push tag to remote
- [ ] Verify CI/actions pass
- [ ] Update project board/release tracker
