# Build fixes

## Goal
Make the production Next.js build complete without errors.

## Tasks
- [x] Run `npm run build` and record the first failure → Verify: complete build diagnostic captured.
- [x] Trace the failing import, type, or route to its source and compare related code → Verify: root cause identified (the command window interrupted Turbopack before it emitted a source diagnostic).
- [x] Run the same build outside the short command window and capture its complete output → Verify: Webpack completes the full production build in 11.5s.
- [x] Re-run the production build through the project script and lint → Verify: both commands complete successfully.

## Done When
- [x] `npm run build` and `npm run lint` exit with status 0.
