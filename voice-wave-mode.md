# Voice Wave Mode

## Goal
Replace the orb with a microphone-reactive Siri-style ribbon that is still at rest, follows speech while listening, and loops continuously while the answer pipeline is thinking.

## Tasks
- [x] Expose frequency-grouped microphone bands from `useRecorder` → Verify listening data stays in mutable refs without React frame-by-frame renders.
- [x] Add the WebGL ribbon renderer and voice-mode component → Verify idle is static, listening reads live bands, thinking uses a continuous simulated signal, and reduced motion renders static frames.
- [x] Replace the orb in `page.tsx` with one accessible bottom CTA → Verify start, stop/send, busy, blocked, and ask-again labels map to the existing recorder/pipeline states.
- [x] Run lint, type/build checks, and visual QA → Verify the page renders cleanly at desktop and mobile widths with no console or WebGL errors.

## Done When
- [x] The orb and red placeholder are gone, one button controls voice mode, and the ribbon clearly distinguishes listening from thinking.
