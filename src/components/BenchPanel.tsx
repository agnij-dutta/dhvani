"use client";

import { useCallback, useState } from "react";
import { IconGaugeFill18 as GaugeIcon } from "nucleo-ui-fill-18/components/IconGaugeFill18";
import { cn } from "./cn";

interface StageStats {
  avg: number;
  p50: number;
  p95: number;
  p99: number;
}

interface BenchResult {
  n: number;
  budgetMs: number;
  pass: boolean;
  stages: Record<"guard" | "embed" | "retrieve" | "total", StageStats>;
}

const STAGE_ORDER = ["guard", "embed", "retrieve", "total"] as const;

/**
 * One-click benchmark: fires N real dataset queries through the retrieval
 * path server-side and prints avg/p50/p95/p99 with a pass/fail verdict
 * against the 200ms budget. Judge-facing — no setup, no terminal.
 */
export function BenchPanel({ className }: { className?: string }) {
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<BenchResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(async () => {
    setRunning(true);
    setError(null);
    try {
      const res = await fetch("/api/bench", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ n: 30 }),
      });
      const json: unknown = await res.json();
      if (!res.ok) {
        const msg = (json as { error?: string }).error ?? `bench returned ${res.status}`;
        throw new Error(msg);
      }
      setResult(json as BenchResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Benchmark failed.");
    } finally {
      setRunning(false);
    }
  }, []);

  const fmt = (v: number | undefined) =>
    typeof v === "number" ? (v >= 100 ? v.toFixed(0) : v.toFixed(2)) : "—";

  return (
    <section className={cn("border-t border-line", className)}>
      <div className="flex flex-wrap items-center justify-between gap-4 py-6">
        <div>
          <p className="tag">latency benchmark</p>
          <p className="mt-1 text-[13px] text-muted">
            30 real dataset queries through guard → embed → retrieve, measured
            server-side on this instance.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void run()}
          disabled={running}
          className={cn(
            "flex min-h-10 items-center gap-2 rounded-full px-4 py-2 text-[12px] font-semibold transition-colors",
            running
              ? "cursor-wait bg-ink-3 text-faint"
              : "bg-paper text-white hover:bg-black",
          )}
        >
          <GaugeIcon
            aria-hidden
            size={14}
            className={running ? "animate-spin" : undefined}
          />
          {running ? "Running…" : "Run benchmark"}
        </button>
      </div>

      {error && (
        <p role="alert" className="border-l-2 border-alert py-2 pl-4 text-[13px] text-alert">
          {error}
        </p>
      )}

      {result && (
        <div className="pb-8">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-line-soft">
                <th className="tag py-2 font-normal">stage</th>
                {(["avg", "p50", "p95", "p99"] as const).map((c) => (
                  <th key={c} className="tag py-2 text-right font-normal">
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {STAGE_ORDER.map((s) => (
                <tr
                  key={s}
                  className={cn(
                    "border-b border-line-soft",
                    s === "total" && "bg-ink-2",
                  )}
                >
                  <td className={cn("py-2.5 text-[13px]", s === "total" ? "text-saffron" : "text-muted")}>
                    {s} <span className="text-faint">(ms)</span>
                  </td>
                  {(["avg", "p50", "p95", "p99"] as const).map((c) => (
                    <td key={c} className="tnum py-2.5 text-right text-[13.5px] text-paper">
                      {fmt(result.stages[s]?.[c])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          <p
            className={cn(
              "mt-4 inline-block rounded-full bg-ink-2 px-3 py-1.5 text-[12px] font-semibold",
              result.pass
                ? "text-jade"
                : "text-alert",
            )}
          >
            {result.pass ? "pass" : "over"} · p95 {fmt(result.stages.total?.p95)}ms against the{" "}
            {result.budgetMs}ms budget · n={result.n}
          </p>
        </div>
      )}
    </section>
  );
}
