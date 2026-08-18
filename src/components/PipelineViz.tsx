"use client";

import type { PipelineStage } from "@/lib/types";
import { PIPELINE_STAGES, type StageState } from "@/hooks/useAskStream";
import { cn } from "./cn";

const STAGE_LABEL: Record<PipelineStage, string> = {
  stt: "listen",
  guard: "guard",
  embed: "embed",
  retrieve: "retrieve",
  generate: "generate",
  grounding: "ground",
};

function stageValue(state: StageState): string {
  if (state.status === "active") return "working";
  if (state.status === "waiting") return "waiting";
  if (state.ms === undefined || state.ms < 0) return "—";
  if (state.ms >= 1000) return `${(state.ms / 1000).toFixed(2)} s`;
  return `${Math.round(state.ms)} ms`;
}

/** Six live pipeline stages presented as a compact segmented metric row. */
export function PipelineViz({
  stages,
  className,
}: {
  stages: Record<PipelineStage, StageState>;
  className?: string;
}) {
  const activeStage = PIPELINE_STAGES.find(
    (stage) => stages[stage].status === "active",
  );

  return (
    <section
      className={cn(
        "w-full overflow-hidden rounded-[8px] border border-line-soft bg-line-soft",
        className,
      )}
      aria-label="Pipeline progress"
    >
      <ol className="grid grid-cols-2 gap-px sm:grid-cols-3 md:grid-cols-6">
        {PIPELINE_STAGES.map((stage) => {
          const s = stages[stage];
          return (
            <li
              key={stage}
              className={cn(
                "flex min-w-0 flex-col items-start gap-2 bg-ink-2 p-3.5 text-left",
                s.status === "active" && "text-paper",
              )}
              aria-current={s.status === "active" ? "step" : undefined}
            >
              <span className="truncate text-[12px] font-normal leading-4 text-faint">
                {STAGE_LABEL[stage]}
              </span>
              <span
                className={cn(
                  "tnum text-[13px] font-medium leading-4 text-paper",
                  s.status === "waiting" && "text-faint",
                  s.status === "active" &&
                    "animate-[dhv-caret_1s_steps(1)_infinite]",
                )}
              >
                {stageValue(s)}
              </span>
            </li>
          );
        })}
      </ol>
      <p className="sr-only" aria-live="polite">
        {activeStage ? `${STAGE_LABEL[activeStage]} in progress` : ""}
      </p>
    </section>
  );
}
