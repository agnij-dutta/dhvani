// Keeps the hot path hot. After a few seconds idle, macOS/Linux deschedule the
// process (efficiency cores, dropped CPU frequency, cold caches) and the next
// query pays 2-4x on embed + retrieve. A cheap synthetic query every 15s keeps
// the ONNX session and the index scan warm without measurable load.

import { embedQuery } from "@/lib/embedder";
import { getIndex } from "@/lib/vindex";

const INTERVAL_MS = Number(process.env.KEEPWARM_INTERVAL_MS) || 5_000;

const g = globalThis as unknown as {
  __dhvaniKeepWarm?: ReturnType<typeof setInterval>;
  __dhvaniLastActivity?: number;
};

/** Called by the pipeline on every real query — recent traffic IS the warmth. */
export function noteActivity(): void {
  g.__dhvaniLastActivity = Date.now();
}

export function ensureKeepWarm(): void {
  if (g.__dhvaniKeepWarm) return;
  let n = 0;
  const timer = setInterval(async () => {
    // skip the CPU work when real queries ran recently — on throttled shared
    // vCPUs the probe itself competes with user requests for the CPU budget
    if (Date.now() - (g.__dhvaniLastActivity ?? 0) < INTERVAL_MS) return;
    try {
      // vary the text so no tokenizer/session cache short-circuits the work
      const v = await embedQuery(`keep warm probe ${n++}`);
      (await getIndex()).search(v, 4, ["sentence"]);
    } catch {
      // index/model not ready yet — the next tick will retry
    }
    // Keep the TLS connection pool to Groq alive: undici drops idle
    // connections after ~4s, and a fresh TCP+TLS handshake costs 50-80ms of
    // TTFT on the next real request. The models endpoint is free and shares
    // the per-origin pool with the SDK's chat calls.
    if (n % 3 === 1 && process.env.GROQ_API_KEY) {
      fetch("https://api.groq.com/openai/v1/models", {
        headers: { authorization: `Bearer ${process.env.GROQ_API_KEY}` },
      }).catch(() => {});
    }
  }, INTERVAL_MS);
  timer.unref?.();
  g.__dhvaniKeepWarm = timer;
}
