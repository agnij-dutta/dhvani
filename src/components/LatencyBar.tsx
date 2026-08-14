"use client";

import type { PipelineTimings } from "@/lib/types";
import { cn, ms } from "./cn";

const TARGET = 200;

const SEGMENTS = [
  { key: "guardMs", label: "guard", color: "#7a4a0d" },
  { key: "embedMs", label: "embed", color: "#a86211" },
  { key: "retrieveMs", label: "retrieve", color: "#e8891a" },
  { key: "ttftMs", label: "first token", color: "#ffc06b" },
] as const;

const clean = (v: number | undefined) =>
  typeof v === "number" && v > 0 ? v : 0;

/**
 * Retrieval-path instrument: guard + embed + retrieve + TTFT against the
 * 200 ms line. STT and full generation are reported separately, not folded in.
 */
export function LatencyBar({
  timings,
  provider,
  className,
}: {
  timings: PipelineTimings;
  provider?: string | null;
  className?: string;
}) {
  const rag = clean(timings.ragMs);
  const under = rag > 0 && rag <= TARGET;
  const axis = Math.max(TARGET * 1.25, Math.ceil((rag * 1.2) / 50) * 50);
  const sum = SEGMENTS.reduce((a, s) => a + clean(timings[s.key]), 0) || 1;

  return (
    <section
      className={cn("border-t border-line pt-7", className)}
      aria-label="Latency breakdown"
    >
      <div className="flex flex-col gap-8 lg:flex-row lg:items-start lg:gap-12">
        {/* the readout */}
        <div className="shrink-0">
          <div className="tag">retrieval path</div>
          <div className="mt-2 flex items-baseline gap-2">
            <span
              className={cn(
                "tnum text-[64px] leading-[0.85] tracking-tight",
                under ? "text-jade" : "text-saffron",
              )}
            >
              {ms(rag)}
            </span>
            <span className="tnum text-[15px] text-muted">{rag >= 1000 ? "" : "ms"}</span>
          </div>
          <div
            className={cn(
              "tag mt-3 inline-flex items-center gap-2 border px-2 py-1",
              under
                ? "border-jade/40 text-jade"
                : "border-saffron/40 text-saffron",
            )}
          >
            <span
              className={cn(
                "h-[5px] w-[5px] rounded-full",
                under ? "bg-jade" : "bg-saffron",
              )}
            />
            {under ? "under 200 ms target" : "over 200 ms target"}
          </div>
        </div>

        {/* the bar */}
        <div className="min-w-0 flex-1">
          <div className="relative pt-6">
            {/* target line */}
            <div
              aria-hidden
              className="absolute top-1 bottom-0 border-l border-dashed border-paper/35"
              style={{ left: `${(TARGET / axis) * 100}%` }}
            >
              <span className="tag absolute -top-[2px] left-2 whitespace-nowrap text-paper/60">
                200 ms target
              </span>
            </div>

            <div className="flex h-3 w-full gap-px overflow-hidden rounded-[2px] bg-ink-2">
              {SEGMENTS.map((seg, i) => {
                const value = clean(timings[seg.key]);
                const share = (value / sum) * (rag / axis);
                return (
                  <div
                    key={seg.key}
                    className="h-full transition-[width] duration-700 ease-out first:rounded-l-[2px]"
                    style={{
                      background: seg.color,
                      width: `${Math.max(0, share * 100)}%`,
                      transitionDelay: `${i * 60}ms`,
                    }}
                  />
                );
              })}
            </div>

            {/* axis */}
            <div className="tnum mt-1.5 flex justify-between text-[10px] text-faint">
              <span>0</span>
              <span>{Math.round(axis)} ms</span>
            </div>
          </div>

          <dl className="mt-5 grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4">
            {SEGMENTS.map((seg) => (
              <div key={seg.key} className="flex items-baseline gap-2">
                <span
                  aria-hidden
                  className="h-[7px] w-[7px] shrink-0 rounded-[1px]"
                  style={{ background: seg.color }}
                />
                <dt className="tag">{seg.label}</dt>
                <dd className="tnum ml-auto text-[13px] text-paper">
                  {ms(timings[seg.key])}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </div>

      <div className="mt-7 flex flex-wrap items-center gap-x-8 gap-y-3 border-t border-line-soft pt-4">
        <Readout label="speech → text" value={ms(timings.sttMs)} />
        <Readout label="generation" value={ms(timings.generateMs)} />
        <Readout label="wall clock" value={ms(timings.totalMs)} />
        {provider && (
          <span className="tag ml-auto normal-case tracking-[0.14em] text-faint">
            via {provider}
          </span>
        )}
      </div>
    </section>
  );
}

function Readout({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline gap-2">
      <span className="tag">{label}</span>
      <span className="tnum text-[13px] text-muted">{value}</span>
    </div>
  );
}
