# Wave load fade

## Goal

Fade in only the WebGL voice wave after its first successful draw so shader startup does not flash.

## Tasks

- [x] Keep the canvas transparent until its first rendered frame is available → Verify: the fallback line remains visible during shader setup.
- [x] Reveal the canvas with a short opacity-only transition → Verify: controls and status text do not animate.
- [x] Run static checks → Verify: `npm run lint` and `npm run build` succeed.

## Done When

- [x] The voice wave gently appears once on initial shader readiness, including in the animation lab.
