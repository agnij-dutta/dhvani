"use client";

import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useState,
    type CSSProperties,
    type ReactNode,
} from "react";
import type { VoiceAnimationState } from "@/lib/voiceAnimationState";
import { cn } from "./cn";

export type VoiceEdgeGlowMode = VoiceAnimationState;

export interface VoiceEdgeGlowProps {
  mode: VoiceEdgeGlowMode;
  borderRadius?: number;
  className?: string;
}

interface VoiceEdgeGlowControls {
  connect: (mode: VoiceEdgeGlowMode) => void;
  disconnect: () => void;
}

const VoiceEdgeGlowContext = createContext<VoiceEdgeGlowControls | null>(null);

const SQUIRCLE_STYLE = {
  cornerShape: "squircle",
} as CSSProperties & { cornerShape: string };

export function VoiceEdgeGlow({
  mode,
  borderRadius = 32,
  className,
}: VoiceEdgeGlowProps) {
  const active = mode === "listening" || mode === "thinking";

  return (
    <>
      <div
        key={mode}
        aria-hidden
        data-active={active}
        data-mode={mode}
        className={cn("rainbow-inset-shadow-effect !rounded-[32px]  blur-2xl", className)}
        style={{ borderRadius }}
      />
      <div
        style={SQUIRCLE_STYLE}
        className="fixed inset-5 z-10000000000 rounded-[inherit] outline-2 outline-white/80 -outline-offset-2 pointer-events-none"
      />
    </>
  );
}

export function VoiceEdgeGlowFrame({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<VoiceEdgeGlowMode>("idle");

  const connect = useCallback((nextMode: VoiceEdgeGlowMode) => {
    setMode((current) => (current === nextMode ? current : nextMode));
  }, []);

  const disconnect = useCallback(() => {
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
            <VoiceEdgeGlow mode={mode} />
            <div className="relative z-100">{children}</div>
          </div>
        </div>
      </div>
    </VoiceEdgeGlowContext.Provider>
  );
}

export function useVoiceEdgeGlow(mode: VoiceEdgeGlowMode) {
  const controls = useContext(VoiceEdgeGlowContext);
  if (!controls) {
    throw new Error("useVoiceEdgeGlow must be used inside VoiceEdgeGlowFrame");
  }

  useEffect(() => {
    controls.connect(mode);
  }, [controls, mode]);

  useEffect(() => controls.disconnect, [controls]);
}
