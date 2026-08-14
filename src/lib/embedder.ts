// Local ONNX embedder — intfloat/multilingual-e5-small via transformers.js.
// Runs in-process so query embedding costs ~15-40ms on Apple Silicon with no
// network hop. E5 requires "query: " / "passage: " prefixes.

import { pipeline, env, type FeatureExtractionPipeline } from "@huggingface/transformers";

env.cacheDir = process.env.HF_CACHE_DIR ?? "./.hf-cache";

export const EMBED_DIM = 384;
const MODEL_ID = "Xenova/multilingual-e5-small";

let extractor: Promise<FeatureExtractionPipeline> | null = null;

function getExtractor(): Promise<FeatureExtractionPipeline> {
  if (!extractor) {
    extractor = pipeline("feature-extraction", MODEL_ID, { dtype: "q8" });
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
  const [v] = await embed([`query: ${text}`]);
  return v;
}

export async function embedPassages(texts: string[]): Promise<Float32Array[]> {
  return embed(texts.map((t) => `passage: ${t}`));
}
