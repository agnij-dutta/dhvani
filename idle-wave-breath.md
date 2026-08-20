# Idle wave breath

## Goal

Give the ready-state voice ribbon a clearly perceptible, but calm, breathing motion without changing its listening or thinking behavior.

## Tasks

- [x] Keep the idle renderer alive only when motion is allowed → Verify: idle returns `true` from the render predicate; reduced motion remains `false`.
- [x] Slow and soften the idle shader pulse and drift → Verify: idle has a long, low-amplitude cycle while active-state formulas are untouched.
- [x] Increase the idle pulse and drift after visual feedback → Verify: the wave peaks below active speech while its motion is clear at rest.
- [x] Update focused regression coverage and run validation → Verify: unit tests, lint, and production build pass.

## Done When

- [x] The idle wave has a clearly perceptible breath and drift while listening and thinking retain their existing behavior.
- [x] Users who prefer reduced motion see a static wave.
