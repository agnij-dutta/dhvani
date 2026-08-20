export interface VoiceBands {
  low: number;
  mid: number;
  high: number;
  level: number;
  /** Short-lived articulation energy used to match the visual to speech pace. */
  cadence?: number;
}

export function createVoiceBands(): VoiceBands {
  return { low: 0, mid: 0, high: 0, level: 0, cadence: 0 };
}
