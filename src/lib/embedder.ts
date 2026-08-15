// Local ONNX embedder — intfloat/multilingual-e5-small via transformers.js.
// Runs in-process so query embedding costs ~15-40ms on Apple Silicon with no
// network hop. E5 requires "query: " / "passage: " prefixes.

import { pipeline, env, type FeatureExtractionPipeline } from "@huggingface/transformers";

env.cacheDir = process.env.HF_CACHE_DIR ?? "./.hf-cache";

export const EMBED_DIM = 384;
// Default is multilingual (Indic text queries work directly). Deployments on
// small instances set EMBED_MODEL=Xenova/all-MiniLM-L6-v2 (~10x smaller RSS,
// English-only) — safe because Sarvam STT-translate normalizes voice queries
// to English before retrieval. Both models are 384-dim.
const MODEL_ID = process.env.EMBED_MODEL ?? "Xenova/multilingual-e5-small";
// E5-family models require "query: "/"passage: " prefixes; others don't.
const USE_E5_PREFIXES = MODEL_ID.includes("e5");

let extractor: Promise<FeatureExtractionPipeline> | null = null;

function getExtractor(): Promise<FeatureExtractionPipeline> {
  if (!extractor) {
    // arena/mem-pattern off: ~150MB less resident memory for ~1.5ms per embed —
    // the right trade on small deploy instances
    extractor = pipeline("feature-extraction", MODEL_ID, {
      dtype: "q8",
      session_options: { enableCpuMemArena: false, enableMemPattern: false },
    } as Parameters<typeof pipeline>[2]);
  }
  return extractor;
}

/** Warm the model so the first user query doesn't pay the load cost. */
export async function warmup(): Promise<void> {
  await embedQuery("warmup");
}

async function embed(texts: string[]): Promise<Float32Array[]> {
  const ex = await getExtractor();
  const out = await ex(texts, { pooling: "mean", normalize: true });
  const [n, dim] = out.dims as [number, number];
  const data = out.data as Float32Array;
  const rows: Float32Array[] = new Array(n);
  for (let i = 0; i < n; i++) rows[i] = data.slice(i * dim, (i + 1) * dim);
  return rows;
}

export async function embedQuery(text: string): Promise<Float32Array> {
  const [v] = await embed([USE_E5_PREFIXES ? `query: ${text}` : text]);
  return v;
}

export async function embedPassages(texts: string[]): Promise<Float32Array[]> {
  return embed(USE_E5_PREFIXES ? texts.map((t) => `passage: ${t}`) : texts);
}
