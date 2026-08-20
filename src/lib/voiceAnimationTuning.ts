export interface VoiceWaveTuning {
  /** Multiplier applied to every autonomous wave clock. */
  playbackSpeed: number;
  /** Overall ribbon height multiplier. */
  amplitude: number;
  /** Distance between the spectral ribbons. */
  spread: number;
  /** Strength of the secondary harmonic. */
  detail: number;
  /** Overall light density of the rendered ribbon. */
  brightness: number;
  /** Strength of the reflected ribbon below the surface. */
  reflection: number;
  listening: {
    wakeBase: number;
    sensitivity: number;
  };
  thinking: {
    intensity: number;
    variation: number;
    wakeBase: number;
    wakeVariation: number;
    wakeSpeed: number;
  };
  response: {
    attack: number;
    release: number;
    lag: number;
  };
}

export interface VoiceAnimationTuning {
  wave: VoiceWaveTuning;
}

export type DeepPartial<T> = {
  [Key in keyof T]?: T[Key] extends object
    ? DeepPartial<T[Key]>
    : T[Key];
};

export type VoiceAnimationTuningOverride = DeepPartial<VoiceAnimationTuning>;

/** Shared brand spectrum for the voice ribbon. */
export const VOICE_WAVE_PALETTE = {
  violet: "#6955ff",
  magenta: "#c83ff0",
  pink: "#ff4e83",
  amber: "#ffad45",
} as const;

/**
 * Canonical production values. The animation lab previews this same contract;
 * paste approved DRKit values here to update every consumer globally.
 */
export const VOICE_ANIMATION_TUNING: VoiceAnimationTuning = {
  wave: {
    playbackSpeed: 1,
    amplitude: 1,
    spread: 1,
    detail: 1,
    brightness: 1,
    reflection: 0.52,
    listening: {
      wakeBase: 0.18,
      sensitivity: 1.5,
    },
    thinking: {
      intensity: 1,
      variation: 1,
      wakeBase: 0.82,
      wakeVariation: 0.08,
      wakeSpeed: 0.61,
    },
    response: {
      attack: 14,
      release: 5.5,
      lag: 13,
    },
  },
};

export function mergeVoiceAnimationTuning(
  base: VoiceAnimationTuning,
  override?: VoiceAnimationTuningOverride,
): VoiceAnimationTuning {
  if (!override) return base;

  return {
    wave: {
      ...base.wave,
      ...override.wave,
      listening: {
        ...base.wave.listening,
        ...override.wave?.listening,
      },
      thinking: {
        ...base.wave.thinking,
        ...override.wave?.thinking,
      },
      response: {
        ...base.wave.response,
        ...override.wave?.response,
      },
    },
  };
}
