// GET /api/health — index manifest, embedder warm status, which providers are
// configured. Booleans only: an env var's *presence* is reportable, its value
// never is.
//
// Doubles as the warmup hook: hitting /api/health on page load pays the ONNX
// model load and index read before the user's first question does.

import { warmup, EMBED_DIM } from "@/lib/embedder";
import { getIndex, type IndexManifest } from "@/lib/vindex";
import { sarvamConfigured } from "@/server/sarvam";
import { geminiConfigured, groqConfigured, GROQ_MODEL, GEMINI_MODEL } from "@/server/generate";
import { OFF_TOPIC_THRESHOLD, GROUNDING_THRESHOLD } from "@/server/guardrails";
import { ensureKeepWarm } from "@/server/keepwarm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type WarmState = "cold" | "warming" | "warm" | "failed";

const g = globalThis as unknown as {
  __dhvaniWarm?: { state: WarmState; promise?: Promise<void>; error?: string };
};

function embedderState(): { status: WarmState; error?: string } {
  const w = g.__dhvaniWarm;
  if (!w) {
    g.__dhvaniWarm = { state: "warming" };
    g.__dhvaniWarm.promise = warmup().then(
      () => {
        g.__dhvaniWarm = { state: "warm" };
      },
      (e: unknown) => {
        g.__dhvaniWarm = { state: "failed", error: (e as Error)?.message ?? String(e) };
      },
    );
    return { status: "warming" };
  }
  return { status: w.state, error: w.error };
}

export async function GET(): Promise<Response> {
  ensureKeepWarm();
  const embedder = embedderState();

  let index:
    | { loaded: true; manifest: IndexManifest }
    | { loaded: false; error: string; dir: string };
  const dir = process.env.INDEX_DIR ?? "data/index";
  try {
    const idx = await getIndex();
    index = { loaded: true, manifest: idx.manifest };
  } catch (e) {
    // don't let a failed load stay memoized on the singleton
    delete (globalThis as { __dhvaniIndex?: unknown }).__dhvaniIndex;
    index = { loaded: false, error: (e as Error)?.message ?? String(e), dir };
  }

  const providers = {
    sarvam: sarvamConfigured(),
    groq: groqConfigured(),
    gemini: geminiConfigured(),
  };

  const ok = index.loaded && embedder.status !== "failed";

  return Response.json(
    {
      ok,
      index,
      embedder: {
        status: embedder.status,
        error: embedder.error,
        model: "Xenova/multilingual-e5-small",
        dim: EMBED_DIM,
      },
      providers,
      generation: {
        primary: providers.groq ? GROQ_MODEL : null,
        fallback: providers.gemini ? GEMINI_MODEL : null,
        available: providers.groq || providers.gemini,
      },
      thresholds: {
        offTopic: OFF_TOPIC_THRESHOLD,
        grounding: GROUNDING_THRESHOLD,
      },
      ts: new Date().toISOString(),
    },
    { status: ok ? 200 : 503, headers: { "cache-control": "no-store" } },
  );
}
