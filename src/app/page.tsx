"use client";

import { useCallback, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle } from "lucide-react";
import { extensionFor, useRecorder } from "@/hooks/useRecorder";
import { useAskStream } from "@/hooks/useAskStream";
import { Rail, RailLink } from "@/components/Wordmark";
import { Orb, type OrbMode } from "@/components/Orb";
import { PipelineViz } from "@/components/PipelineViz";
import { TranscriptBar } from "@/components/TranscriptBar";
import { AnswerPanel } from "@/components/AnswerPanel";
import { RefusalPanel } from "@/components/RefusalPanel";
import { ChunkCard } from "@/components/ChunkCard";
import { LatencyBar } from "@/components/LatencyBar";
import { AskBar } from "@/components/AskBar";

const EASE = [0.16, 1, 0.3, 1] as const;

export default function Home() {
  const recorder = useRecorder();
  const { state, ask, busy } = useAskStream();
  const [activeCitation, setActiveCitation] = useState<number | null>(null);

  const started = state.phase !== "idle";

  const handleStop = useCallback(async () => {
    const utterance = await recorder.stop();
    if (!utterance) return;
    await ask({
      blob: utterance.blob,
      filename: `utterance.${extensionFor(utterance.mimeType)}`,
    });
  }, [recorder, ask]);

  const orbMode: OrbMode = busy
    ? "processing"
    : recorder.state === "recording"
      ? "recording"
      : recorder.state === "requesting"
        ? "requesting"
        : recorder.state === "denied" || recorder.state === "unsupported"
          ? "blocked"
          : "idle";

  const hasResult =
    state.transcript || state.answer || state.refusal || state.chunks.length > 0;

  return (
    <>
      <Rail>
        <span className="tag hidden sm:inline">msmarco-xi · 22 languages</span>
        <RailLink href="/analytics">Analytics</RailLink>
      </Rail>

      <main className="mx-auto w-full max-w-[1180px] flex-1 px-6 pb-28 sm:px-8">
        {/* ── console ─────────────────────────────────────────── */}
        <section className="flex flex-col items-center pt-8 sm:pt-10">
          <AnimatePresence initial={false}>
            {!started && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10, height: 0 }}
                transition={{
                  duration: 0.45,
                  ease: EASE,
                  opacity: { duration: 0.18 },
                }}
                className="overflow-hidden pb-2 text-center"
              >
                <p className="tag">voice → retrieval → grounded answer</p>
                <h1 className="mx-auto mt-3 max-w-[13ch] font-display text-[34px] leading-[1.08] tracking-tight text-paper sm:text-[44px]">
                  Ask out loud. In your language.
                </h1>
              </motion.div>
            )}
          </AnimatePresence>

          <Orb
            mode={orbMode}
            levelRef={recorder.levelRef}
            onStart={recorder.start}
            onStop={handleStop}
          />

          <p className="tag -mt-4 text-center">
            {orbMode === "recording"
              ? "listening — release to send"
              : orbMode === "processing"
                ? "running the chain"
                : "hold to speak · tap to latch · space works too"}
          </p>
        </section>

        {/* ── the signal chain ────────────────────────────────── */}
        <PipelineViz stages={state.stages} className="mt-14 sm:mt-16" />

        <div className="mx-auto mt-14 w-full max-w-[640px]">
          <AskBar onSubmit={(text) => void ask({ text })} disabled={busy} />

          {recorder.error && (
            <p
              role="alert"
              className="mt-3 flex items-start gap-2 text-[12.5px] leading-relaxed text-alert"
            >
              <AlertTriangle size={13} className="mt-0.5 shrink-0" strokeWidth={1.6} />
              {recorder.error}
            </p>
          )}
          {state.error && (
            <p
              role="alert"
              className="mt-3 flex items-start gap-2 text-[12.5px] leading-relaxed text-alert"
            >
              <AlertTriangle size={13} className="mt-0.5 shrink-0" strokeWidth={1.6} />
              {state.error}
            </p>
          )}
        </div>

        {/* ── result ──────────────────────────────────────────── */}
        <AnimatePresence>
          {hasResult && (
            <motion.section
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.5, ease: EASE }}
              className="mt-20 grid grid-cols-1 gap-x-14 gap-y-12 lg:grid-cols-[minmax(0,1fr)_360px]"
            >
              <div className="min-w-0">
                {state.transcript && (
                  <TranscriptBar
                    text={state.transcript.text}
                    languageCode={state.transcript.languageCode}
                    className="border-b border-line-soft pb-5"
                  />
                )}

                {state.refusal ? (
                  <RefusalPanel refusal={state.refusal} className="mt-8" />
                ) : (
                  (state.answer || busy) && (
                    <div className="mt-8">
                      <div className="flex items-center gap-4">
                        <span className="tag">answer</span>
                        {state.grounding && (
                          <span
                            className={`tag ${
                              state.grounding.grounded ? "text-jade" : "text-alert"
                            }`}
                          >
                            grounding {state.grounding.score.toFixed(2)}
                            {state.grounding.grounded ? " · grounded" : " · weak"}
                          </span>
                        )}
                      </div>
                      <AnswerPanel
                        className="mt-4"
                        text={state.answer}
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
                    className="mt-14"
                  />
                )}
              </div>

              {/* sources */}
              <aside className="min-w-0 lg:sticky lg:top-20 lg:self-start">
                <div className="flex items-baseline justify-between border-b border-line-soft pb-3">
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
                  <ol className="mt-6 space-y-7 lg:max-h-[calc(100vh-11rem)] lg:overflow-y-auto lg:pr-2">
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
      </main>
    </>
  );
}
