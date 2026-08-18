"use client";

import { useMemo } from "react";
import { cn } from "./cn";

const BUCKETS = 24;

/**
 * Where the runs actually land. Bars left of the target line are the ones that
 * met it — the whole point of the chart is that boundary.
 */
export function Distribution({
  values,
  target = 200,
  className,
}: {
  values: number[];
  target?: number;
  className?: string;
}) {
  const { bins, max, width, hi } = useMemo(() => {
    const clean = values.filter((v) => Number.isFinite(v) && v >= 0);
    const hi = Math.max(target * 1.5, ...clean, 1);
    const width = hi / BUCKETS;
    const bins = new Array<number>(BUCKETS).fill(0);
    for (const v of clean) {
      const i = Math.min(BUCKETS - 1, Math.floor(v / width));
      bins[i] += 1;
    }
    return { bins, max: Math.max(1, ...bins), width, hi };
  }, [values, target]);

  const targetPct = Math.min(100, (target / hi) * 100);

  return (
    <figure className={cn("border-t border-line pt-6", className)}>
      <figcaption className="flex items-baseline justify-between">
        <span className="tag">ragMs distribution</span>
        <span className="tnum text-[11px] text-faint">
          {values.length} runs
        </span>
      </figcaption>

      <div className="relative mt-6 h-[132px]">
        <div
          aria-hidden
          className="absolute inset-y-0 z-10 border-l border-dashed border-paper/35"
          style={{ left: `${targetPct}%` }}
        >
          <span className="tag absolute -top-5 left-2 whitespace-nowrap text-paper/60">
            200 ms
          </span>
        </div>

        <div className="flex h-full items-end gap-[2px]">
          {bins.map((count, i) => {
            const under = (i + 1) * width <= target;
            return (
              <div
                key={i}
                className="group relative flex-1"
                style={{ height: "100%" }}
              >
                <div
                  className={cn(
                    "absolute bottom-0 w-full rounded-t-[1px] transition-[height] duration-500",
                    under ? "bg-paper/80" : "bg-faint/55",
                  )}
                  style={{ height: `${(count / max) * 100}%` }}
                />
                <span className="tnum pointer-events-none absolute bottom-full left-1/2 mb-1 hidden -translate-x-1/2 whitespace-nowrap rounded-full bg-paper px-2 py-1 text-[10px] text-white group-hover:block">
                  {count} · {Math.round(i * width)}–{Math.round((i + 1) * width)}ms
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="tnum mt-2 flex justify-between border-t border-line-soft pt-2 text-[10px] text-faint">
        <span>0</span>
        <span>{Math.round(hi)} ms</span>
      </div>
    </figure>
  );
}
