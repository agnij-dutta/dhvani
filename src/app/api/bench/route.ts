// POST /api/bench — one-click server-side latency benchmark.
// Runs N real dataset queries through the retrieval path (guard + embed +
// retrieve, no generation so it's cheap and provider-independent) and returns
// avg/p50/p95/p99 per stage plus PASS/FAIL against the 200ms task budget.

import { promises as fs } from "fs";
import { runPipeline } from "@/server/pipeline";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BUDGET_MS = 200;
const MAX_N = 50;

const FALLBACK_QUERIES = [
  "what is a corporation",
  "what helps with diarrhea in babies",
  "price of a yard of carpet",
  "what is the purpose of vlookup in excel",
  "how much does a standard sedan weigh",
  "what is patella tendinitis",
  "what does the name curtis mean",
  "what percentage of test-takers pass the bar exam",
];

function percentile(vals: number[], pct: number): number {
  const v = [...vals].sort((a, b) => a - b);
  const k = (v.length - 1) * (pct / 100);
  const f = Math.floor(k);
  const c = Math.min(f + 1, v.length - 1);
  return f === c ? v[f] : v[f] + (k - f) * (v[c] - v[f]);
}

function stats(vals: number[]) {
  return {
    avg: vals.reduce((a, b) => a + b, 0) / vals.length,
    p50: percentile(vals, 50),
    p95: percentile(vals, 95),
    p99: percentile(vals, 99),
  };
}

async function loadQueries(): Promise<string[]> {
  try {
    const raw = await fs.readFile("data/eval_queries.jsonl", "utf8");
    const qs = raw
      .split("\n")
      .filter(Boolean)
      .map((l) => JSON.parse(l) as { query?: string })
      .map((q) => q.query)
      .filter((q): q is string => typeof q === "string" && q.trim().length > 0);
    return qs.length ? qs : FALLBACK_QUERIES;
  } catch {
    return FALLBACK_QUERIES;
  }
}

export async function POST(req: Request): Promise<Response> {
  let n = 30;
  try {
    const body = (await req.json()) as { n?: number };
    if (typeof body.n === "number") n = body.n;
  } catch {
    // default n
  }
  n = Math.max(5, Math.min(MAX_N, Math.floor(n)));

  const queries = await loadQueries();
  const noop = () => {};

  // one unrecorded warmup so the first sample isn't a cold-load outlier
  await runPipeline({ text: queries[0] }, noop, { generate: false, record: false });

  const guard: number[] = [];
  const embed: number[] = [];
  const retrieve: number[] = [];
  const total: number[] = [];
  for (let i = 0; i < n; i++) {
    const q = queries[(i * 7 + 1) % queries.length];
    // pace samples like real user queries: a back-to-back loop measures CPU
    // saturation on shared instances (Render throttles at ~0.1 vCPU), not the
    // per-query latency the budget is about
    if (i > 0) await new Promise((r) => setTimeout(r, 350));
    const res = await runPipeline({ text: q }, noop, { generate: false, record: false });
    const t = res.timings;
    if (t.retrieveMs < 0) continue; // refused before retrieval — not a latency sample
    guard.push(Math.max(0, t.guardMs));
    embed.push(Math.max(0, t.embedMs));
    retrieve.push(Math.max(0, t.retrieveMs));
    total.push(Math.max(0, t.guardMs) + Math.max(0, t.embedMs) + Math.max(0, t.retrieveMs));
  }

  if (!total.length) {
    return Response.json({ error: "no successful samples — is the index built?" }, { status: 500 });
  }

  const totalStats = stats(total);
  return Response.json({
    n: total.length,
    budgetMs: BUDGET_MS,
    pass: totalStats.p95 <= BUDGET_MS,
    stages: {
      guard: stats(guard),
      embed: stats(embed),
      retrieve: stats(retrieve),
      total: totalStats,
    },
  });
}
