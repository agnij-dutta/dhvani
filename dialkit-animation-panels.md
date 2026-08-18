# Dialkit animation lab controls

## Goal

Add a floating Dialkit-powered control panel to `/test` so the voice wave can
be tuned live and copied as structured JSON. The CSS edge glow is previewed
alongside it with no runtime tuning controls.

## Steps

1. Register the Wave control schema using the canonical animation defaults.
2. Render one scoped floating panel and route its resolved values into the
   test-page tuning provider.
3. Provide copy feedback, keep the panel usable on compact screens,
   and verify formatting, types, build, and the rendered page.

## Acceptance checks

- Wave controls update only the wave specimen in real time.
- The edge glow has no JavaScript control surface or animation loop.
- The panel copies an object ready to paste into the global tuning contract.
- The rest of the application continues using the canonical defaults.
