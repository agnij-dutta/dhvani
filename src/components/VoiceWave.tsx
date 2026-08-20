"use client";

import { useEffect, useRef } from "react";
import { useReducedMotion } from "framer-motion";
import { IconMediaStopFill18 as StopIcon } from "nucleo-ui-fill-18/components/IconMediaStopFill18";
import { IconMicrophone3Fill18 as MicrophoneIcon } from "nucleo-ui-fill-18/components/IconMicrophone3Fill18";
import type { VoiceBands } from "@/lib/voiceBands";
import { VOICE_WAVE_PALETTE } from "@/lib/voiceAnimationTuning";
import { useVoiceAnimationTuning } from "./VoiceAnimationTuningProvider";
import { cn } from "./cn";
import { VoiceWaveRenderer, type VoiceWaveMode } from "./voice-wave/engine";

interface VoiceWaveProps {
  mode: VoiceWaveMode;
  bandsRef: React.RefObject<VoiceBands>;
  requesting?: boolean;
  idleLabel?: string;
  onStart: () => void | Promise<void>;
  onStop: () => void | Promise<void>;
  className?: string;
}

export function VoiceWave({
  mode,
  bandsRef,
  requesting = false,
  idleLabel = "Ask a question",
  onStart,
  onStop,
  className,
}: VoiceWaveProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<VoiceWaveRenderer | null>(null);
  const shouldReduceMotion = useReducedMotion();
  const { wave: waveTuning } = useVoiceAnimationTuning();

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const renderer = new VoiceWaveRenderer(host, bandsRef);
    rendererRef.current = renderer;
    return () => {
      renderer.destroy();
      rendererRef.current = null;
    };
  }, [bandsRef]);

  useEffect(() => {
    rendererRef.current?.setTuning(waveTuning);
  }, [waveTuning]);

  useEffect(() => {
    rendererRef.current?.setMode(mode, Boolean(shouldReduceMotion));
  }, [mode, shouldReduceMotion]);

  const recording = mode === "listening" && !requesting;
  const disabled = mode === "thinking" || mode === "blocked" || requesting;
  const buttonLabel =
    mode === "thinking"
      ? "Thinking…"
      : mode === "blocked"
        ? "Microphone unavailable"
        : requesting
          ? "Opening microphone…"
          : recording
            ? "Done speaking"
            : idleLabel;
  const status =
    mode === "thinking"
      ? "Thinking through your question"
      : mode === "blocked"
        ? "Voice mode is unavailable"
        : requesting
          ? "Waiting for microphone access"
          : recording
            ? "Listening… speak in any language"
            : "Voice mode is ready";

  return (
    <div
      className={cn("flex h-[260px] w-full flex-col items-center", className)}
    >
      <div
        ref={hostRef}
        aria-hidden
        className="relative h-[184px] w-full isolate overflow-hidden bg-white"
      >
        <div
          className="absolute left-1/2 top-1/2 h-px w-[76%] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-70"
          style={{
            background:
              `linear-gradient(90deg, transparent, ${VOICE_WAVE_PALETTE.violet} 18%, ${VOICE_WAVE_PALETTE.magenta} 39%, ${VOICE_WAVE_PALETTE.pink} 62%, ${VOICE_WAVE_PALETTE.amber} 82%, transparent)`,
            boxShadow:
              "0 0 8px rgba(122, 78, 255, .34), 0 0 18px rgba(255, 76, 139, .18)",
          }}
        />
      </div>

      <div className="relative z-10 gap-6 flex flex-col items-center justify-center">
        <button
          type="button"
          aria-label={buttonLabel}
          aria-pressed={recording}
          disabled={disabled}
          onClick={() => {
            if (recording) void onStop();
            else void onStart();
          }}
          className={cn(
            "flex size-12 items-center justify-center gap-2 rounded-full text-[14px] font-semibold transition-[transform,background-color,opacity] duration-150 ease-out active:scale-[0.97] disabled:active:scale-100",
            recording
              ? "text-paper bg-ink-2 hover:bg-ink-3/70"
              : "text-black/80 bg-transparent hover:bg-ink-2",
            mode === "thinking" && "cursor-progress",
            mode === "blocked" &&
              "cursor-not-allowed bg-ink-3 text-muted hover:bg-ink-3",
            requesting && "cursor-wait",
            disabled && mode !== "blocked" && "opacity-60",
          )}
        >
          <span
            aria-hidden
            className="t-icon-swap voice-wave-icon-swap leading-none"
            data-state={recording ? "b" : "a"}
          >
            <span className="t-icon" data-icon="a">
              <MicrophoneIcon size={18} />
            </span>
            <span className="t-icon" data-icon="b">
              <StopIcon size={12} />
            </span>
          </span>
        </button>

        <p
          aria-live="polite"
          className="text-[12px] font-medium text-faint"
        >
          {status}
        </p>
      </div>
    </div>
  );
}
