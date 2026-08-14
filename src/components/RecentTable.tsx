"use client";

import type { AnalyticsRecord } from "@/lib/types";
import { languageName } from "./TranscriptBar";
import { cn, ms } from "./cn";

function clock(ts: number): string {
  if (!Number.isFinite(ts)) return "—";
  return new Date(ts).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

export function RecentTable({
  records,
  className,
}: {
  records: AnalyticsRecord[];
  className?: string;
}) {
  return (
    <section className={cn("border-t border-line pt-6", className)}>
      <div className="flex items-baseline justify-between">
        <h2 className="tag">recent queries</h2>
        <span className="tnum text-[11px] text-faint">{records.length}</span>
      </div>

      {records.length === 0 ? (
        <p className="mt-6 text-[13px] text-faint">
          No runs logged yet. Ask something on the console and it lands here.
        </p>
      ) : (
        <div className="mt-4 -mx-2 overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse text-left">
            <thead>
              <tr className="border-b border-line-soft">
                {["time", "query", "language", "provider", "rag", "total"].map(
                  (h) => (
                    <th
                      key={h}
                      scope="col"
                      className="tag px-2 pb-2 font-normal last:text-right"
                    >
                      {h}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {records.map((r, i) => {
                const rag = r.timings?.ragMs ?? -1;
                const under = rag > 0 && rag <= 200;
                return (
                  <tr
                    key={`${r.ts}-${i}`}
                    className="border-b border-line-soft/60 transition-colors hover:bg-ink-2"
                  >
                    <td className="tnum px-2 py-3 text-[12px] text-faint">
                      {clock(r.ts)}
                    </td>
                    <td className="max-w-[320px] truncate px-2 py-3 text-[13px] text-paper">
                      {r.refused && (
                        <span className="tag mr-2 text-alert">refused</span>
                      )}
                      {r.query || "—"}
                    </td>
                    <td className="px-2 py-3 text-[12px] text-muted">
                      {r.languageCode ? languageName(r.languageCode) : "—"}
                    </td>
                    <td className="tnum px-2 py-3 text-[12px] text-muted">
                      {r.provider || "—"}
                    </td>
                    <td
                      className={cn(
                        "tnum px-2 py-3 text-[13px]",
                        under ? "text-jade" : "text-saffron",
                      )}
                    >
                      {ms(rag)}
                    </td>
                    <td className="tnum px-2 py-3 text-right text-[12px] text-faint">
                      {ms(r.timings?.totalMs)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
