# Shared voice animation tuning

## Goal
Create one typed animation-tuning contract that can be previewed on `/test` and committed once for every production consumer.

## Tasks
- [x] Add the canonical wave tuning schema/defaults → Verify every exposed value is serializable and DRKit-friendly.
- [x] Add a global tuning provider plus nested override support → Verify the root layout and test lab share the same contract.
- [x] Refactor the WebGL wave to read live tuning values → Verify slider-like updates do not recreate the wave renderer.
- [x] Wire `/test` through its own preview scope → Verify future controls can override the lab without changing production during tuning.
- [x] Run lint, type/build checks, and a browser smoke test → Verify `/` and `/test` render and state changes still work.

## Done When
- [x] Copied tuning values have one canonical file to update and automatically affect the wave globally.
- [x] Reduced-motion behavior and current visual defaults are preserved.

## Notes
The control panel will remain a preview tool. Global persistence happens by committing its copied values to the canonical defaults object.
