"use client";

import { useCallback, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { IconChevronRightFill18 as ChevronRightIcon } from "nucleo-ui-fill-18/components/IconChevronRightFill18";
import { IconTriangleWarningFill18 as WarningIcon } from "nucleo-ui-fill-18/components/IconTriangleWarningFill18";
import { extensionFor, useRecorder } from "@/hooks/useRecorder";
import { useAskStream } from "@/hooks/useAskStream";
import { Rail, RailLink } from "@/components/Wordmark";
import { VoiceWave } from "@/components/VoiceWave";
import type { VoiceWaveMode } from "@/components/voice-wave/engine";
import { PipelineViz } from "@/components/PipelineViz";
import { TranscriptBar } from "@/components/TranscriptBar";
import { AnswerPanel } from "@/components/AnswerPanel";
import { RefusalPanel } from "@/components/RefusalPanel";
import { ChunkCard } from "@/components/ChunkCard";
import { LatencyBar } from "@/components/LatencyBar";
import { AskBar } from "@/components/AskBar";
import {
  useVoiceEdgeGlow,
  type VoiceEdgeGlowMode,
} from "@/components/VoiceEdgeGlowFrame";

const EASE = [0.16, 1, 0.3, 1] as const;
const QUICK_QUESTIONS = [
  "Why is the sky blue?",
  "What causes tides?",
  "How do vaccines work?",
] as const;

export default function Home() {
  const recorder = useRecorder();
  const { state, ask, busy } = useAskStream();
  const [activeCitation, setActiveCitation] = useState<number | null>(null);
  const [sendingVoice, setSendingVoice] = useState(false);
  const shouldReduceMotion = useReducedMotion();

  const started = state.phase !== "idle";

  const handleStop = useCallback(async () => {
    setSendingVoice(true);
    try {
      const utterance = await recorder.stop();
      if (!utterance) return;
      await ask({
        blob: utterance.blob,
        filename: `utterance.${extensionFor(utterance.mimeType)}`,
      });
    } finally {
      setSendingVoice(false);
    }
  }, [recorder, ask]);

  const interactionBusy = busy || sendingVoice;
  const microphoneBlocked =
    recorder.state === "denied" ||
    recorder.state === "unsupported" ||
    recorder.state === "error";
  const voiceMode: VoiceWaveMode = interactionBusy
    ? "thinking"
    : recorder.state === "recording" || recorder.state === "requesting"
      ? "listening"
      : microphoneBlocked
        ? "blocked"
        : "idle";
  const inputDisabled =
    interactionBusy ||
    recorder.state === "recording" ||
    recorder.state === "requesting";
  const voiceEdgeGlowMode: VoiceEdgeGlowMode = interactionBusy
    ? "thinking"
    : recorder.state === "recording" || recorder.state === "requesting"
      ? "listening"
      : "idle";

  useVoiceEdgeGlow(voiceEdgeGlowMode);

  return (
    <>
      <Rail>
        <span className="tag hidden px-3 sm:inline">
          English + 22 Indic · cited answers
        </span>
        <RailLink href="/analytics">Analytics</RailLink>
      </Rail>

      <main className="mx-auto w-full max-w-[1240px] flex-1 px-4 pb-10 sm:px-6">
        <section className="flex flex-col items-center">
          <AnimatePresence initial={false}>
            {!started && (
              <motion.div
                initial={
                  shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 10 }
                }
                animate={{ opacity: 1, y: 0 }}
                exit={
                  shouldReduceMotion
                    ? { opacity: 0 }
                    : { opacity: 0, y: -10, height: 0 }
                }
                transition={
                  shouldReduceMotion
                    ? { duration: 0.18 }
                    : {
                        duration: 0.45,
                        ease: EASE,
                        opacity: { duration: 0.18 },
                      }
                }
                className="overflow-hidden text-center"
              >
                <div className="py-10">
                  <h1 className="mx-auto max-w-[12ch] text-balance font-display text-[46px] font-semibold leading-[0.98] tracking-[-0.04em] text-paper">
                    Ask out loud in any language
                  </h1>
                  <p className="mx-auto mt-5 max-w-[560px] text-balance text-[14px] leading-[1.6] font-medium opacity-60">
                    Speak in English or any of 22 Indic languages
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="h-[260px] w-full my-12">
            <VoiceWave
              mode={voiceMode}
              bandsRef={recorder.bandsRef}
              requesting={recorder.state === "requesting"}
              idleLabel={started ? "Ask another question" : "Ask a question"}
              onStart={recorder.start}
              onStop={handleStop}
            />
          </div>
        </section>

        <section className="relative mt-14 rounded-[24px] bg-ink-2 px-4 pb-10 pt-16 sm:mt-16 sm:px-8">
          <AskBar
            onSubmit={(text) => void ask({ text })}
            disabled={inputDisabled}
            className="absolute -top-7 left-1/2 z-10 w-[calc(100%_-_1.5rem)] max-w-[752px] -translate-x-1/2"
          />

          <div className="flex flex-col gap-8">
            {(recorder.error || state.error) && (
              <div className="mx-auto flex w-full max-w-[700px] flex-col gap-3">
                {recorder.error && (
                  <ErrorNotice kind="microphone" message={recorder.error} />
                )}
                {state.error && (
                  <ErrorNotice kind="request" message={state.error} />
                )}
              </div>
            )}

            {!started && (
              <div className="mx-auto flex w-full max-w-[700px] flex-col items-center gap-6">
                <div
                  role="group"
                  aria-label="Quick questions"
                  className="flex flex-wrap justify-center gap-2"
                >
                  {QUICK_QUESTIONS.map((question) => (
                    <button
                      key={question}
                      type="button"
                      disabled={inputDisabled}
                      onClick={() => void ask({ text: question })}
                      className="min-h-11 rounded-full bg-white px-4 text-[12px] font-medium leading-none text-muted transition-colors hover:bg-paper hover:text-white disabled:cursor-not-allowed disabled:opacity-40 sm:min-h-8"
                    >
                      {question}
                    </button>
                  ))}
                </div>

                <p className="flex max-w-[620px] flex-wrap items-center justify-center gap-x-2.5 gap-y-1 text-center text-[12px] leading-5 text-faint">
                  <span className="whitespace-nowrap">Voice or text</span>
                  <span aria-hidden className="hidden sm:inline">
                    ·
                  </span>
                  <span className="whitespace-nowrap">MS MARCO-XI evidence</span>
                  <span aria-hidden className="hidden sm:inline">
                    ·
                  </span>
                  <span className="whitespace-nowrap">Grounded citations</span>
                </p>
              </div>
            )}

            <AnimatePresence>
              {started && (
                <motion.section
                  initial={
                    shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 16 }
                  }
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={
                    shouldReduceMotion
                      ? { duration: 0.18 }
                      : { duration: 0.5, ease: EASE }
                  }
                  className="grid grid-cols-1 gap-x-10 gap-y-12 lg:grid-cols-[minmax(0,1fr)_360px]"
                >
                  <div className="min-w-0">
                    {state.transcript && (
                      <TranscriptBar
                        text={state.transcript.text}
                        languageCode={state.transcript.languageCode}
                      />
                    )}

                    <PipelineViz
                      stages={state.stages}
                      className={state.transcript ? "mt-5" : undefined}
                    />

                    {state.refusal ? (
                      <RefusalPanel refusal={state.refusal} className="mt-6" />
                    ) : (
                      (state.answer || busy || state.error) && (
                        <div className="mt-5">
                          {state.grounding && (
                            <span
                              className={`tag rounded-full bg-white px-2.5 py-1 ${
                                state.grounding.grounded
                                  ? "text-jade"
                                  : "text-alert"
                              }`}
                            >
                              grounding {state.grounding.score.toFixed(2)}
                              {state.grounding.grounded
                                ? " · grounded"
                                : " · weak"}
                            </span>
                          )}
                          <AnswerPanel
                            className={state.grounding ? "mt-3" : undefined}
                            text={
                              state.answer ||
                              (state.error
                                ? "I couldn't generate an answer right now."
                                : "")
                            }
                            streaming={busy}
                            maxCitation={state.chunks.length}
                            activeCitation={activeCitation}
                            onCitation={setActiveCitation}
                          />
                        </div>
                      )
                    )}

                    {state.timings && (
                      <LatencyBar
                        timings={state.timings}
                        provider={state.provider}
                        className="mt-6"
                      />
                    )}
                  </div>

                  <aside className="min-w-0 border-t border-line pt-8 lg:sticky lg:top-24 lg:mt-7 lg:self-start lg:border-t-0 lg:border-l lg:pt-0 lg:pl-10">
                    <div className="flex items-baseline justify-between border-b border-line pb-3">
                      <span className="tag">retrieved passages</span>
                      <span className="tnum text-[12px] text-faint">
                        {state.chunks.length}
                      </span>
                    </div>
                    {state.chunks.length === 0 ? (
                      <p className="mt-5 text-[13px] leading-relaxed text-faint">
                        {busy
                          ? "Searching the index…"
                          : "No passages were retrieved for this question."}
                      </p>
                    ) : (
                      <ol className="mt-1 lg:max-h-[calc(100vh-10rem)] lg:overflow-y-auto lg:pr-2">
                        {state.chunks.map((chunk, i) => (
                          <ChunkCard
                            key={chunk.id ?? i}
                            chunk={chunk}
                            index={i + 1}
                            active={activeCitation === i + 1}
                            onFocusChange={setActiveCitation}
                          />
                        ))}
                      </ol>
                    )}
                  </aside>
                </motion.section>
              )}
            </AnimatePresence>
          </div>
        </section>
      </main>

      <footer className="mx-auto w-full max-w-[1240px] px-4 pb-8 sm:px-6">
        <div className="flex flex-col gap-2 border-t border-line-soft pt-5 text-[12px] leading-5 text-faint sm:flex-row sm:items-center sm:justify-between">
          <p>Dhvani ध्वनि · multilingual voice to grounded, cited answers.</p>
          <p className="sm:text-right">
            HH Goa 2026 submission · Sarvam STT · local MS MARCO-XI retrieval
          </p>
        </div>
      </footer>
    </>
  );
}

function ErrorNotice({
  kind,
  message,
}: {
  kind: "microphone" | "request";
  message: string;
}) {
  const microphone = kind === "microphone";

  return (
    <div
      role="alert"
      className="rounded-[12px] bg-white px-4 py-3.5 text-alert"
    >
      <WarningIcon aria-hidden size={15} className="shrink-0" />
      <div className="mt-2 min-w-0 text-[13px] leading-relaxed">
        <p className="font-semibold text-paper">
          {microphone
            ? "The microphone isn’t ready."
            : "The answer couldn’t finish."}
        </p>
        <p className="mt-0.5 text-muted">
          {microphone
            ? "Check your browser permission, or type the question instead."
            : "Try again in a moment or ask a different question."}
        </p>
        <details className="group mt-2 text-faint">
          <summary className="flex min-h-6 w-fit cursor-pointer list-none items-center gap-1.5 [&::-webkit-details-marker]:hidden">
            <ChevronRightIcon
              aria-hidden
              size={10}
              className="transition-transform group-open:rotate-90"
            />
            Technical details
          </summary>
          <p className="mt-2 break-words text-[11px] leading-5">{message}</p>
        </details>
      </div>
    </div>
  );
}
