# Voice wave transition fix

## Goal

Make the `/test` voice wave settle into idle without a phase jump and keep every spatial wave layer traveling right-to-left.

## Tasks

- [x] Trace active-to-idle state flow and shader phase terms → Verify: identify the exact snap and counter-traveling term.
- [x] Add focused regression checks → Verify: current implementation fails the idle-tail and phase-direction assertions.
- [x] Preserve phase and decay residual energy before stopping → Verify: listening/thinking can enter idle without replacing the live frame.
- [x] Align every shader phase term right-to-left → Verify: all spatial phase velocities have the same sign.
- [x] Run lint, type/build checks, and browser replay → Verify: idle transitions settle smoothly, interruption is continuous, and reduced motion remains static.

## Done When

- [x] Listening → Idle and Thinking → Idle have no visible jump.
- [x] The ribbon only travels right-to-left.
- [x] The animation stops after settling and remains static for reduced-motion users.
