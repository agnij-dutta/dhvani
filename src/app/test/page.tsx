"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type RefObject,
} from "react";
import {
  ControlRenderer,
  DialStore,
  useDialKit,
  type DialConfig,
  type DialValue,
} from "dialkit";
import "dialkit/styles.css";
import { useReducedMotion } from "framer-motion";
import Link from "next/link";
import { VoiceAnimationTuningProvider } from "@/components/VoiceAnimationTuningProvider";
import { VoiceEdgeGlow } from "@/components/VoiceEdgeGlowFrame";
import { VoiceWave } from "@/components/VoiceWave";
import { cn } from "@/components/cn";
import {
  VOICE_ANIMATION_STATES,
  type VoiceAnimationState,
} from "@/lib/voiceAnimationState";
import { createVoiceBands, type VoiceBands } from "@/lib/voiceBands";
import {
  VOICE_ANIMATION_TUNING,
  type VoiceWaveTuning,
} from "@/lib/voiceAnimationTuning";

const STATE_COPY: Record<
  VoiceAnimationState,
  { label: string; description: string }
> = {
  idle: {
    label: "Idle",
    description: "Resting and ready, with no active signal.",
  },
  listening: {
    label: "Listening",
    description: "Following a synthetic voice envelope in real time.",
  },
  thinking: {
    label: "Thinking",
    description: "Running the component's processing rhythm.",
  },
};

const DEMO_FRAME_MS = 1000 / 30;

const WAVE_DIAL_CONFIG = {
  playbackSpeed: [VOICE_ANIMATION_TUNING.wave.playbackSpeed, 0.25, 3, 0.01] as [
    number,
    number,
    number,
    number,
  ],
  amplitude: [VOICE_ANIMATION_TUNING.wave.amplitude, 0, 2, 0.01] as [
    number,
    number,
    number,
    number,
  ],
  spread: [VOICE_ANIMATION_TUNING.wave.spread, 0, 3, 0.01] as [
    number,
    number,
    number,
    number,
  ],
  detail: [VOICE_ANIMATION_TUNING.wave.detail, 0, 3, 0.01] as [
    number,
    number,
    number,
    number,
  ],
  brightness: [VOICE_ANIMATION_TUNING.wave.brightness, 0, 3, 0.01] as [
    number,
    number,
    number,
    number,
  ],
  reflection: [VOICE_ANIMATION_TUNING.wave.reflection, 0, 1, 0.01] as [
    number,
    number,
    number,
    number,
  ],
  listening: {
    wakeBase: [VOICE_ANIMATION_TUNING.wave.listening.wakeBase, 0, 1, 0.01] as [
      number,
      number,
      number,
      number,
    ],
    sensitivity: [
      VOICE_ANIMATION_TUNING.wave.listening.sensitivity,
      0,
      3,
      0.01,
    ] as [number, number, number, number],
  },
  thinking: {
    _collapsed: true,
    intensity: [VOICE_ANIMATION_TUNING.wave.thinking.intensity, 0, 2, 0.01] as [
      number,
      number,
      number,
      number,
    ],
    variation: [VOICE_ANIMATION_TUNING.wave.thinking.variation, 0, 2, 0.01] as [
      number,
      number,
      number,
      number,
    ],
    wakeBase: [VOICE_ANIMATION_TUNING.wave.thinking.wakeBase, 0, 1, 0.01] as [
      number,
      number,
      number,
      number,
    ],
    wakeVariation: [
      VOICE_ANIMATION_TUNING.wave.thinking.wakeVariation,
      0,
      0.3,
      0.01,
    ] as [number, number, number, number],
    wakeSpeed: [VOICE_ANIMATION_TUNING.wave.thinking.wakeSpeed, 0, 3, 0.01] as [
      number,
      number,
      number,
      number,
    ],
  },
  response: {
    _collapsed: true,
    attack: [VOICE_ANIMATION_TUNING.wave.response.attack, 0.1, 15, 0.1] as [
      number,
      number,
      number,
      number,
    ],
    release: [VOICE_ANIMATION_TUNING.wave.response.release, 0.1, 10, 0.1] as [
      number,
      number,
      number,
      number,
    ],
    lag: [VOICE_ANIMATION_TUNING.wave.response.lag, 0.1, 15, 0.1] as [
      number,
      number,
      number,
      number,
    ],
  },
} satisfies DialConfig;

const EMPTY_DIAL_VALUES: Record<string, DialValue> = {};

function useDialPanelValues(panelId: string) {
  const subscribe = useCallback(
    (listener: () => void) => DialStore.subscribe(panelId, listener),
    [panelId],
  );
  const getSnapshot = useCallback(
    () => DialStore.getValues(panelId),
    [panelId],
  );

  return useSyncExternalStore(subscribe, getSnapshot, () => EMPTY_DIAL_VALUES);
}

function FloatingDialPanel({
  panelId,
  title,
  copyKey,
  values,
}: {
  panelId: string;
  title: string;
  copyKey: "wave";
  values: VoiceWaveTuning;
}) {
  const flatValues = useDialPanelValues(panelId);
  const panel = DialStore.getPanel(panelId);
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied" | "failed">(
    "idle",
  );
  const copiedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (copiedTimer.current) clearTimeout(copiedTimer.current);
    },
    [],
  );

  if (!panel) return null;

  const copyValues = async () => {
    if (copiedTimer.current) clearTimeout(copiedTimer.current);
    try {
      await navigator.clipboard.writeText(
        JSON.stringify({ [copyKey]: values }, null, 2),
      );
      setCopyStatus("copied");
    } catch {
      setCopyStatus("failed");
    }
    copiedTimer.current = setTimeout(() => setCopyStatus("idle"), 1600);
  };

  return (
    <aside
      aria-label={`${title} animation controls`}
      className="dialkit-root dialkit-lab-panel"
    >
      <div className="dialkit-panel-inner dialkit-lab-panel-inner">
        <div className="dialkit-panel-header dialkit-lab-panel-header">
          <span className="dialkit-folder-title dialkit-folder-title-root">
            {title}
          </span>
          <button
            type="button"
            className="dialkit-lab-copy"
            onClick={() => void copyValues()}
          >
            {copyStatus === "copied"
              ? "Copied"
              : copyStatus === "failed"
                ? "Copy failed"
                : "Copy JSON"}
          </button>
        </div>
        <div className="dialkit-lab-controls">
          <ControlRenderer
            panelId={panelId}
            controls={panel.controls}
            values={flatValues}
          />
        </div>
      </div>
    </aside>
  );
}

function clamp(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function useDemoVoiceBands(
  mode: VoiceAnimationState,
): RefObject<VoiceBands> {
  const bandsRef = useRef<VoiceBands>(createVoiceBands());
  const shouldReduceMotion = Boolean(useReducedMotion());

  useEffect(() => {
    const bands = bandsRef.current;
    const setBands = (
      low: number,
      mid: number,
      high: number,
      level: number,
    ) => {
      bands.low = low;
      bands.mid = mid;
      bands.high = high;
      bands.level = level;
    };

    if (mode !== "listening") {
      setBands(0, 0, 0, 0);
      return;
    }

    if (shouldReduceMotion) {
      setBands(0.34, 0.42, 0.28, 0.46);
      return;
    }

    let animationFrame = 0;
    let lastDraw = 0;
    const startedAt = performance.now();

    const tick = (now: number) => {
      animationFrame = requestAnimationFrame(tick);
      if (now - lastDraw < DEMO_FRAME_MS) return;

      const time = (now - startedAt) / 1000;
      const phrase =
        0.68 +
        Math.sin(time * 0.78) * 0.13 +
        Math.sin(time * 0.31 + 1.2) * 0.08;
      const syllable = Math.max(
        0,
        Math.sin(time * 6.1) * 0.58 +
          Math.sin(time * 9.4 + 0.7) * 0.28,
      );
      const pause = Math.sin(time * 0.59 + 0.3) > -0.62 ? 1 : 0.28;
      const level = clamp(
        (0.14 + phrase * (0.22 + syllable * 0.58)) * pause,
      );

      setBands(
        clamp(level * (0.9 + Math.sin(time * 2.3) * 0.12)),
        clamp(level * (1.04 + Math.sin(time * 3.7 + 0.8) * 0.15)),
        clamp(level * (0.7 + Math.sin(time * 5.2 + 1.6) * 0.18)),
        level,
      );
      lastDraw = now;
    };

    animationFrame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(animationFrame);
      setBands(0, 0, 0, 0);
    };
  }, [mode, shouldReduceMotion]);

  return bandsRef;
}

function StateSelector({
  label,
  value,
  onChange,
}: {
  label: string;
  value: VoiceAnimationState;
  onChange: (state: VoiceAnimationState) => void;
}) {
  return (
    <div
      role="group"
      aria-label={`${label} state`}
      className="inline-flex w-fit flex-wrap gap-1 rounded-full bg-ink-2 p-1"
    >
      {VOICE_ANIMATION_STATES.map((state) => {
        const selected = state === value;

        return (
          <button
            key={state}
            type="button"
            aria-pressed={selected}
            onClick={() => onChange(state)}
            className={cn(
              "min-h-11 rounded-full px-4 text-[13px] font-semibold transition-[background-color,color,transform] duration-150 ease-out active:scale-[0.97]",
              selected
                ? "bg-paper text-white"
                : "text-muted hover:bg-white hover:text-paper",
            )}
          >
            {STATE_COPY[state].label}
          </button>
        );
      })}
    </div>
  );
}

function StateDescription({ state }: { state: VoiceAnimationState }) {
  return (
    <p className="max-w-[46ch] text-[16px] leading-6 text-muted">
      <span className="font-semibold text-paper">
        {STATE_COPY[state].label}.
      </span>{" "}
      {STATE_COPY[state].description}
    </p>
  );
}

export default function TestPage() {
  const [waveState, setWaveState] =
    useState<VoiceAnimationState>("idle");
  const [edgeGlowState, setEdgeGlowState] =
    useState<VoiceAnimationState>("idle");
  const waveBandsRef = useDemoVoiceBands(waveState);
  const waveTuning = useDialKit(
    "Voice wave",
    WAVE_DIAL_CONFIG,
    { id: "dhvani-voice-wave" },
  ) as VoiceWaveTuning;
  return (
    <VoiceAnimationTuningProvider
      value={{ wave: waveTuning }}
    >
      <main className="min-h-full bg-ink px-5 py-10 sm:px-8 sm:py-16">
      <div className="mx-auto w-full max-w-[880px]">
        <header className="flex flex-col gap-7 border-b border-line-soft pb-10 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-[650px]">
            <h1 className="max-w-[11ch] text-[clamp(2.75rem,7vw,4.75rem)] font-semibold leading-[0.96] tracking-[-0.04em] text-paper">
              Voice animation lab
            </h1>
            <p className="mt-5 max-w-[62ch] text-[16px] leading-7 text-muted">
              Tune the production wave and preview the shell edge glow. Each
              specimen has its own Idle, Listening, and Thinking state so you
              can compare them independently.
            </p>
          </div>

          <Link
            href="/"
            className="inline-flex min-h-11 w-fit items-center rounded-full bg-paper px-5 text-[13px] font-semibold text-white transition-[background-color,transform] duration-150 ease-out hover:bg-black active:scale-[0.97]"
          >
            Back to Dhvani
          </Link>
        </header>

        <div className="mt-12 space-y-16 sm:mt-16 sm:space-y-20">
          <section aria-labelledby="wave-heading">
            <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2
                  id="wave-heading"
                  className="text-[25px] font-semibold tracking-[-0.03em] text-paper"
                >
                  Voice wave
                </h2>
                <div className="mt-2">
                  <StateDescription state={waveState} />
                </div>
              </div>

              <StateSelector
                label="Voice wave"
                value={waveState}
                onChange={setWaveState}
              />
            </div>

            <div className="mt-7 overflow-hidden rounded-[24px] bg-ink-2 px-3 py-6 sm:px-8 sm:py-8">
              <VoiceWave
                mode={waveState}
                bandsRef={waveBandsRef}
                idleLabel="Start listening"
                onStart={() => setWaveState("listening")}
                onStop={() => setWaveState("thinking")}
                className="mx-auto max-w-[760px]"
              />
            </div>
          </section>

          <section
            aria-labelledby="edge-glow-heading"
            className="border-t border-line-soft pt-16 sm:pt-20"
          >
            <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2
                  id="edge-glow-heading"
                  className="text-[25px] font-semibold tracking-[-0.03em] text-paper"
                >
                  Edge glow
                </h2>
                <div className="mt-2">
                  <StateDescription state={edgeGlowState} />
                </div>
              </div>

              <StateSelector
                label="Edge glow"
                value={edgeGlowState}
                onChange={setEdgeGlowState}
              />
            </div>

            <div className="mt-7 rounded-[24px] bg-black p-3 sm:p-5">
              <div className="relative min-h-[320px] overflow-hidden rounded-[32px] bg-white">
                <VoiceEdgeGlow mode={edgeGlowState} />

                <div className="relative z-10 flex min-h-[320px] flex-col items-center justify-center px-7 text-center">
                  <p
                    aria-live="polite"
                    className="text-[40px] font-semibold leading-none tracking-[-0.04em] text-paper"
                  >
                    {STATE_COPY[edgeGlowState].label}
                  </p>
                  <p className="mt-4 max-w-[34ch] text-[16px] leading-6 text-muted">
                    {STATE_COPY[edgeGlowState].description}
                  </p>
                </div>
              </div>
            </div>
          </section>
        </div>

        <p className="mt-16 border-t border-line-soft pt-6 text-[12px] leading-5 text-faint sm:mt-20">
          Listening input on this page is simulated. The production voice wave
          still reads live microphone bands on the main experience.
        </p>
      </div>
      </main>
      <div className="dialkit-lab-stack">
        <FloatingDialPanel
          panelId="dhvani-voice-wave"
          title="Voice wave"
          copyKey="wave"
          values={waveTuning}
        />
      </div>
    </VoiceAnimationTuningProvider>
  );
}
