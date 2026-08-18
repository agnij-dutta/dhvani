# Figma Bottom Stats Section

## Goal
Apply the supplied pre-question and post-answer Figma layouts to the main page’s lower workbench while preserving the existing header, voice hero, and interaction behavior.

## Tasks
- [x] Recompose the lower workbench so the ask field overlaps its top edge and the idle prompts match the pre-question state. → Verify: the existing rail and voice section remain unchanged.
- [x] Restyle transcript, six pipeline metrics, answer/refusal, latency, and passage rail to match the post-answer state. → Verify: live pipeline data and citations remain interactive.
- [x] Use installed Nucleo components for every icon touched by the lower section. → Verify: no handwritten SVG or non-Nucleo icon is introduced.
- [x] Harden the lower workbench at desktop and mobile widths without changing focus order or reduced-motion behavior. → Verify: no clipping or horizontal page overflow.
- [x] Run lint, build, the Impeccable detector, and one desktop/mobile visual QA pass. → Verify: checks pass and both states preserve the upper page.

## Done When
- [x] The main page keeps its current top section and renders the Figma-inspired lower stats section correctly before and after a question.
