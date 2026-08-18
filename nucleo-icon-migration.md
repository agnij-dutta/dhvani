# Nucleo Icon Migration

## Goal
Replace every rendered Lucide interface icon with a semantically equivalent Nucleo UI Fill 18 icon while preserving behavior and accessibility.

## Tasks
- [x] Inventory icon imports and distinguish UI icons from the Orb data visualization and brand assets. → Verify: all `lucide-react` imports and source SVG markup are accounted for.
- [x] Replace icons in console, analytics, voice, refusal, source, input, and benchmark components using direct Nucleo component imports. → Verify: no Lucide imports remain and each decorative icon is hidden from assistive technology.
- [x] Remove the unused Lucide dependency from both package-manager lockfiles. → Verify: manifests and lockfiles contain no `lucide-react` entries.
- [x] Run lint, type/build checks, the Impeccable detector, and desktop/mobile visual QA. → Verify: checks pass and both routes render with consistent filled icons.

## Done When
- [x] Every interface icon comes from `nucleo-ui-fill-18`, without changing labels, interaction behavior, or the custom voice visualization.
