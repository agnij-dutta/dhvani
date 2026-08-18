export const VOICE_ANIMATION_STATES = [
  "idle",
  "listening",
  "thinking",
] as const;

export type VoiceAnimationState =
  (typeof VOICE_ANIMATION_STATES)[number];
