export interface VoiceBands {
  low: number;
  mid: number;
  high: number;
  level: number;
}

export function createVoiceBands(): VoiceBands {
  return { low: 0, mid: 0, high: 0, level: 0 };
}
