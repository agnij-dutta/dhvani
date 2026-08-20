"use client";

import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState,
    type CSSProperties,
    type ReactNode,
    type RefObject,
} from "react";
import { useReducedMotion } from "framer-motion";
import type { VoiceBands } from "@/lib/voiceBands";
import type { VoiceAnimationState } from "@/lib/voiceAnimationState";
import { cn } from "./cn";

export type VoiceEdgeGlowMode = VoiceAnimationState;

export interface VoiceEdgeGlowProps {
  mode: VoiceEdgeGlowMode;
  bandsRef?: RefObject<VoiceBands>;
  borderRadius?: number;
  className?: string;
}

interface VoiceEdgeGlowControls {
  connect: (mode: VoiceEdgeGlowMode, bandsRef?: RefObject<VoiceBands>) => void;
  disconnect: () => void;
}

const VoiceEdgeGlowContext = createContext<VoiceEdgeGlowControls | null>(null);

const SQUIRCLE_STYLE = {
  cornerShape: "squircle",
} as CSSProperties & { cornerShape: string };

export function VoiceEdgeGlow({
  mode,
  bandsRef,
  borderRadius = 32,
  className,
}: VoiceEdgeGlowProps) {
  const active = mode === "listening" || mode === "thinking";
  const glowRef = useRef<HTMLDivElement>(null);
  const shouldReduceMotion = useReducedMotion();

  useEffect(() => {
    const glow = glowRef.current;
    if (!glow || mode !== "listening" || shouldReduceMotion) return;

    let frame = 0;
    let opacity = 0.28;
    let lastFrame = performance.now();

    const tick = (now: number) => {
      const delta = Math.min(0.1, Math.max(1 / 240, (now - lastFrame) / 1000));
      lastFrame = now;

      const bands = bandsRef?.current;
      const level = Math.min(1, Math.max(0, bands?.level ?? 0));
      const cadence = Math.min(
        1,
        Math.max(0, bands?.cadence ?? bands?.high ?? 0),
      );
      const voicedEnergy = Math.min(1, Math.max(0, (level - 0.025) * 2.2));
      const target =
        0.27 +
        Math.min(1, voicedEnergy * 0.78 + cadence * 0.24) * 0.53;
      const response = target > opacity ? 18 : 7;
      opacity += (target - opacity) * Math.min(1, delta * response);

      // Opacity is composite-only, and the glow has no descendants, so this
      // remains fluid without triggering React work for each audio frame.
      glow.style.opacity = opacity.toFixed(3);
      frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      glow.style.removeProperty("opacity");
    };
  }, [bandsRef, mode, shouldReduceMotion]);

  return (
    <>
      <div
        aria-hidden
        ref={glowRef}
        data-active={active}
        data-mode={mode}
        className={cn("rainbow-inset-shadow-effect", className)}
        style={{ borderRadius, ...SQUIRCLE_STYLE }}
      />
      <div
        style={SQUIRCLE_STYLE}
        className="fixed inset-5 z-10000000000 rounded-[inherit] outline-2 outline-black/8 -outline-offset-2 pointer-events-none"
      />
    </>
  );
}

export function VoiceEdgeGlowFrame({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<VoiceEdgeGlowMode>("idle");
  const [bandsRef, setBandsRef] = useState<RefObject<VoiceBands> | undefined>();

  const connect = useCallback(
    (nextMode: VoiceEdgeGlowMode, nextBandsRef?: RefObject<VoiceBands>) => {
      setBandsRef(nextBandsRef);
      setMode((current) => (current === nextMode ? current : nextMode));
    },
    [],
  );

  const disconnect = useCallback(() => {
    setBandsRef(undefined);
    setMode("idle");
  }, []);

  const controls = useMemo(
    () => ({ connect, disconnect }),
    [connect, disconnect],
  );

  return (
    <VoiceEdgeGlowContext.Provider value={controls}>
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden bg-black p-5">
        <div className="relative min-h-0 flex-1">
          <div
            className="relative z-10 h-full overflow-auto rounded-[32px] bg-ink text-paper"
            style={SQUIRCLE_STYLE}
          >
            <VoiceEdgeGlow mode={mode} bandsRef={bandsRef} />
            <div className="relative z-100">{children}</div>
          </div>
        </div>
      </div>
    </VoiceEdgeGlowContext.Provider>
  );
}

export function useVoiceEdgeGlow(
  mode: VoiceEdgeGlowMode,
  bandsRef?: RefObject<VoiceBands>,
) {
  const controls = useContext(VoiceEdgeGlowContext);
  if (!controls) {
    throw new Error("useVoiceEdgeGlow must be used inside VoiceEdgeGlowFrame");
  }

  useEffect(() => {
    controls.connect(mode, bandsRef);
  }, [bandsRef, controls, mode]);

  useEffect(() => controls.disconnect, [controls]);
}
