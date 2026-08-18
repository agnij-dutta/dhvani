"use client";

import {
  createContext,
  useContext,
  useMemo,
  type ReactNode,
} from "react";
import {
  VOICE_ANIMATION_TUNING,
  mergeVoiceAnimationTuning,
  type VoiceAnimationTuning,
  type VoiceAnimationTuningOverride,
} from "@/lib/voiceAnimationTuning";

const VoiceAnimationTuningContext =
  createContext<VoiceAnimationTuning>(VOICE_ANIMATION_TUNING);

export function VoiceAnimationTuningProvider({
  children,
  value,
}: {
  children: ReactNode;
  value?: VoiceAnimationTuningOverride;
}) {
  const inheritedTuning = useContext(VoiceAnimationTuningContext);
  const tuning = useMemo(
    () => mergeVoiceAnimationTuning(inheritedTuning, value),
    [inheritedTuning, value],
  );

  return (
    <VoiceAnimationTuningContext.Provider value={tuning}>
      {children}
    </VoiceAnimationTuningContext.Provider>
  );
}

export function useVoiceAnimationTuning(): VoiceAnimationTuning {
  return useContext(VoiceAnimationTuningContext);
}
