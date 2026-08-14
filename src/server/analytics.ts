// Append-only analytics log + percentile stats.
//
// One AnalyticsRecord per line in data/analytics.jsonl. Append-only because the
// write happens on the request path: an fs.appendFile of ~300 bytes is a single
// syscall, and a corrupt line can never poison earlier ones.
//
// Percentiles use nearest-rank (P_k = value at ceil(k/100 * n) in sorted order)
// — no interpolation, so every reported number is a latency that actually
// happened rather than an average of two that didn't.

import { promises as fs } from "fs";
import path from "path";
import type { AnalyticsRecord, LatencyStats, PipelineTimings } from "@/lib/types";

export const ANALYTICS_PATH =
  process.env.ANALYTICS_PATH ?? path.join(process.cwd(), "data", "analytics.jsonl");

export type TimingField = keyof PipelineTimings;

export const TIMING_FIELDS: TimingField[] = [
  "sttMs",
  "guardMs",
  "embedMs",
  "retrieveMs",
  "ttftMs",
  "generateMs",
  "ragMs",
  "totalMs",
];

/** Fields that only mean something once retrieval actually ran. */
const RAG_FIELDS = new Set<TimingField>(["embedMs", "retrieveMs", "ttftMs", "ragMs", "generateMs"]);

export type OverallStats = Record<TimingField, LatencyStats>;

const EMPTY_STATS: LatencyStats = { count: 0, p50: 0, p70: 0, p90: 0, p100: 0, mean: 0 };

/** Append one record. Never throws — analytics must not break a live answer. */
export async function appendRecord(record: AnalyticsRecord): Promise<void> {
  try {
    await fs.mkdir(path.dirname(ANALYTICS_PATH), { recursive: true });
    await fs.appendFile(ANALYTICS_PATH, JSON.stringify(record) + "\n", "utf8");
  } catch (e) {
    console.warn(`[analytics] append failed: ${(e as Error).message}`);
  }
}

/** Read every record. Missing file => []. Malformed lines are skipped. */
export async function readRecords(): Promise<AnalyticsRecord[]> {
  let raw: string;
  try {
    raw = await fs.readFile(ANALYTICS_PATH, "utf8");
  } catch {
    return [];
  }
  const out: AnalyticsRecord[] = [];
  for (const line of raw.split("\n")) {
    if (!line.trim()) continue;
    try {
      out.push(JSON.parse(line) as AnalyticsRecord);
    } catch {
      // skip a torn line rather than 500 the analytics endpoint
    }
  }
  return out;
}

/** Nearest-rank percentile over an already-sorted ascending array. */
function nearestRank(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const rank = Math.ceil((p / 100) * sorted.length);
  return sorted[Math.min(Math.max(rank, 1), sorted.length) - 1];
}

export function statsFor(values: number[]): LatencyStats {
  const clean = values.filter((v) => Number.isFinite(v) && v >= 0);
  if (clean.length === 0) return { ...EMPTY_STATS };
  const sorted = [...clean].sort((a, b) => a - b);
  const sum = sorted.reduce((a, b) => a + b, 0);
  return {
    count: sorted.length,
    p50: round(nearestRank(sorted, 50)),
    p70: round(nearestRank(sorted, 70)),
    p90: round(nearestRank(sorted, 90)),
    p100: round(nearestRank(sorted, 100)),
    mean: round(sum / sorted.length),
  };
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Per-field LatencyStats across records.
 *
 * A record refused before retrieval (guard rejected the input) has no
 * meaningful embed/retrieve/ttft/rag numbers — those stages never ran and are
 * recorded as -1. They are excluded from the rag-side fields so a wave of
 * blocked queries can't fake a great P50. `-1` (stage skipped) is filtered
 * everywhere by statsFor().
 */
export function computeStats(records: AnalyticsRecord[]): OverallStats {
  const out = {} as OverallStats;
  for (const field of TIMING_FIELDS) {
    const pool = RAG_FIELDS.has(field)
      ? records.filter((r) => !refusedBeforeRetrieval(r))
      : records;
    out[field] = statsFor(pool.map((r) => r.timings?.[field] ?? -1));
  }
  return out;
}

function refusedBeforeRetrieval(r: AnalyticsRecord): boolean {
  return Boolean(r.refused) && (r.timings?.retrieveMs ?? -1) < 0;
}

export interface AnalyticsPayload {
  overall: OverallStats;
  recent: AnalyticsRecord[];
}

/** What GET /api/analytics returns. `recent` is newest-first. */
export async function getAnalytics(recentLimit = 50): Promise<AnalyticsPayload> {
  const records = await readRecords();
  return {
    overall: computeStats(records),
    recent: records.slice(-recentLimit).reverse(),
  };
}
