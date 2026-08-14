"use client";

import type { PipelineStage } from "@/lib/types";
import { PIPELINE_STAGES, type StageState } from "@/hooks/useAskStream";
import { cn, ms } from "./cn";

const STAGE_LABEL: Record<PipelineStage, string> = {
  stt: "listen",
  guard: "guard",
  embed: "embed",
  retrieve: "retrieve",
  generate: "generate",
  grounding: "ground",
};

/**
 * The signal chain. Six stages left to right; the line between them carries an
 * amber charge as the utterance travels, and each node reports its own ms.
 */
export function PipelineViz({
  stages,
  className,
}: {
  stages: Record<PipelineStage, StageState>;
  className?: string;
}) {
  const lastLit = PIPELINE_STAGES.reduce(
    (acc, stage, i) => (stages[stage].status === "waiting" ? acc : i),
    -1,
  );
  const anyActive = PIPELINE_STAGES.some(
    (s) => stages[s].status === "active",
  );
  const progress = lastLit < 0 ? 0 : lastLit / (PIPELINE_STAGES.length - 1);
  const EDGE = 100 / (PIPELINE_STAGES.length * 2); // half a column, in %

  return (
    <section
      className={cn("w-full", className)}
      aria-label="Pipeline progress"
    >
      <div className="relative">
        {/* rail: spans node-centre to node-centre */}
        <div
          aria-hidden
          className="pointer-events-none absolute top-[26px]"
          style={{ left: `${EDGE}%`, right: `${EDGE}%` }}
        >
          <div className="h-px w-full bg-line" />
          <div
            className="absolute inset-x-0 top-0 h-px origin-left bg-saffron transition-transform duration-500 ease-out"
            style={{ transform: `scaleX(${progress})` }}
          />
          {anyActive && (
            <span
              className="absolute top-[-3px] h-[7px] w-[7px] -translate-x-1/2 rounded-full bg-saffron-hi shadow-[0_0_14px_3px_rgba(232,137,26,0.55)] transition-[left] duration-500 ease-out"
              style={{ left: `${progress * 100}%` }}
            />
          )}
        </div>

        <ol className="relative grid grid-cols-6">
          {PIPELINE_STAGES.map((stage) => {
            const s = stages[stage];
            const lit = s.status !== "waiting";
            return (
              <li
                key={stage}
                className="flex flex-col items-center gap-3"
                aria-current={s.status === "active" ? "step" : undefined}
              >
                <span
                  className={cn(
                    "font-mono text-[8px] uppercase tracking-[0.1em] text-faint transition-colors duration-300 sm:text-[10px] sm:tracking-[0.16em]",
                    lit && "text-paper",
                    s.status === "active" && "text-saffron",
                  )}
                >
                  {STAGE_LABEL[stage]}
                </span>

                <span className="relative flex h-3 w-3 items-center justify-center">
                  {s.status === "active" && (
                    <span
                      aria-hidden
                      className="absolute inset-0 animate-[dhv-ping_1.1s_ease-out_infinite] rounded-full border border-saffron"
                    />
                  )}
                  <span
                    className={cn(
                      "h-[7px] w-[7px] rounded-full ring-4 ring-ink transition-colors duration-300",
                      s.status === "waiting" && "bg-line",
                      s.status === "active" && "bg-saffron-hi",
                      s.status === "done" && "bg-saffron",
                    )}
                  />
                </span>

                <span
                  className={cn(
                    "tnum text-[13px] leading-none tabular-nums transition-colors duration-300",
                    s.status === "done" ? "text-paper" : "text-faint",
                  )}
                >
                  {s.status === "done" ? (
                    <>
                      {ms(s.ms)}
                      <span className="ml-0.5 text-[9px] text-faint">ms</span>
                    </>
                  ) : s.status === "active" ? (
                    <span className="animate-[dhv-caret_1s_steps(1)_infinite] text-saffron">
                      ···
                    </span>
                  ) : (
                    "·"
                  )}
                </span>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
