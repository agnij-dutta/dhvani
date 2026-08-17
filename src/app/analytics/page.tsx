"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AlertTriangle } from "lucide-react";
import type { AnalyticsRecord, LatencyStats, PipelineTimings } from "@/lib/types";
import { Rail, RailLink } from "@/components/Wordmark";
import { StatTile } from "@/components/StatTile";
import { Distribution } from "@/components/Distribution";
import { RecentTable } from "@/components/RecentTable";
import { BenchPanel } from "@/components/BenchPanel";

type Overall = Partial<Record<keyof PipelineTimings, LatencyStats>>;

interface Payload {
  overall: Overall;
  recent: AnalyticsRecord[];
}

const FIELDS: Array<{ key: keyof PipelineTimings; label: string }> = [
  { key: "sttMs", label: "speech → text" },
  { key: "guardMs", label: "guard" },
  { key: "embedMs", label: "embed" },
  { key: "retrieveMs", label: "retrieve" },
  { key: "ttftMs", label: "first token" },
  { key: "generateMs", label: "generation" },
  { key: "totalMs", label: "wall clock" },
];

export default function AnalyticsPage() {
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [beat, setBeat] = useState(0);
  const mounted = useRef(true);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/analytics", { cache: "no-store" });
      if (!res.ok) throw new Error(`Analytics returned ${res.status}`);
      const json: unknown = await res.json();
      if (!mounted.current) return;
      const payload = json as Partial<Payload>;
      setData({
        overall:
          payload.overall && typeof payload.overall === "object"
            ? payload.overall
            : {},
        recent: Array.isArray(payload.recent) ? payload.recent : [],
      });
      setError(null);
      setBeat((b) => b + 1);
    } catch (err) {
      if (!mounted.current) return;
      setError(err instanceof Error ? err.message : "Couldn't reach analytics.");
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    void load();
    const id = setInterval(() => void load(), 5000);
    return () => {
      mounted.current = false;
      clearInterval(id);
    };
  }, [load]);

  const recent = data?.recent ?? [];
  const ragValues = recent
    .map((r) => r.timings?.ragMs)
    .filter((v): v is number => typeof v === "number" && v >= 0);
  const runs = data?.overall?.ragMs?.count ?? recent.length;

  return (
    <>
      <Rail>
        <span className="tag hidden sm:inline">refreshing every 5s</span>
        <RailLink href="/">Console</RailLink>
      </Rail>

      <main className="mx-auto w-full max-w-[1180px] flex-1 px-6 pb-28 sm:px-8">
        <header className="flex flex-wrap items-end justify-between gap-6 pt-12 pb-10 sm:pt-16">
          <div>
            <p className="tag">latency ledger</p>
            <h1 className="mt-3 font-display text-[40px] leading-none tracking-tight text-paper sm:text-[52px]">
              Every run, measured
            </h1>
          </div>
          <div className="flex items-center gap-6">
            <div className="text-right">
              <div className="tag">runs logged</div>
              <div className="tnum mt-1 text-[26px] leading-none text-paper">
                {runs}
              </div>
            </div>
            <span
              key={beat}
              className="h-[7px] w-[7px] rounded-full bg-jade shadow-[0_0_10px_2px_rgba(87,201,138,0.5)]"
              aria-label="Live"
            />
          </div>
        </header>

        {error && (
          <p
            role="alert"
            className="mb-8 flex items-center gap-2 border-l-2 border-alert py-3 pl-4 text-[13px] text-alert"
          >
            <AlertTriangle size={14} strokeWidth={1.6} />
            {error} — retrying every 5 seconds.
          </p>
        )}

        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          <StatTile
            label="retrieval path · ragMs"
            stats={data?.overall?.ragMs}
            target={200}
            emphasis
          />
          {FIELDS.map((f) => (
            <StatTile key={f.key} label={f.label} stats={data?.overall?.[f.key]} />
          ))}
        </section>

        <BenchPanel className="mt-16" />

        <Distribution values={ragValues} className="mt-16" />

        <RecentTable records={recent.slice(0, 40)} className="mt-16" />
      </main>
    </>
  );
}
