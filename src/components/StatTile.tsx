"use client";

import type { LatencyStats } from "@/lib/types";
import { cn, ms } from "./cn";

/**
 * One field of the timing record, read as a percentile column.
 * P50 is the headline; the tail is what actually matters, so it sits right there.
 */
export function StatTile({
  label,
  stats,
  target,
  emphasis,
}: {
  label: string;
  stats: LatencyStats | undefined;
  target?: number;
  emphasis?: boolean;
}) {
  const p50 = stats?.p50;
  const under = target !== undefined && typeof p50 === "number" && p50 <= target;

  return (
    <div
      className={cn(
        "border-t border-line px-5 py-5",
        emphasis && "bg-[linear-gradient(180deg,rgba(232,137,26,0.06),transparent_70%)]",
      )}
    >
      <div className="flex items-baseline justify-between">
        <span className={cn("tag", emphasis && "text-saffron")}>{label}</span>
        {target !== undefined && (
          <span
            className={cn(
              "tag",
              under ? "text-jade" : "text-alert",
            )}
          >
            {under ? "pass" : "over"}
          </span>
        )}
      </div>

      <div className="mt-2.5 flex items-baseline gap-1.5">
        <span
          className={cn(
            "tnum leading-none tracking-tight",
            emphasis ? "text-[46px]" : "text-[34px]",
            target !== undefined
              ? under
                ? "text-jade"
                : "text-saffron"
              : "text-paper",
          )}
        >
          {ms(p50)}
        </span>
        <span className="tnum text-[11px] text-faint">
          {typeof p50 === "number" && p50 >= 1000 ? "p50" : "ms p50"}
        </span>
      </div>

      <dl className="mt-4 space-y-1.5">
        {(["p70", "p90", "p100"] as const).map((key) => (
          <div key={key} className="flex items-baseline justify-between">
            <dt className="tag">{key}</dt>
            <dd className="tnum text-[12.5px] text-muted">
              {ms(stats?.[key])}
            </dd>
          </div>
        ))}
        <div className="flex items-baseline justify-between border-t border-line-soft pt-1.5">
          <dt className="tag">mean</dt>
          <dd className="tnum text-[12.5px] text-faint">{ms(stats?.mean)}</dd>
        </div>
      </dl>
    </div>
  );
}
