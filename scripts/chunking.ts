// Five real chunking strategies over MSMARCO-XI English passages.
//
// MS MARCO passages are short (median ~49 words, p90 ~81 in our 2.5k-row
// sample), so on most passages several strategies collapse to a single chunk.
// That is expected: the strategies only differentiate on the long tail
// (p99 ~200+ words), which is exactly where retrieval normally degrades.
// scripts/eval_chunking.ts measures whether that tail actually matters.

import type { ChunkMeta, ChunkStrategy } from "../src/lib/types";
import { embedPassages } from "../src/lib/embedder";

/** One deduped passage as emitted by scripts/sample_dataset.py. */
export interface CorpusPassage {
  /** `${queryId}:${passageIdx}` */
  id: string;
  queryId: number;
  passageIdx: number;
  isSelected: number;
  queryType: string;
  langPair: string;
  text: string;
  engQuery: string;
  engAnswer: string;
}

export const STRATEGIES: ChunkStrategy[] = [
  "fixed",
  "sentence",
  "sliding",
  "semantic",
  "parent",
];

// Tunables, in whitespace-delimited words (~0.75 words per e5 token, so a
// 120-word window sits comfortably inside the 512-token model context).
const FIXED_WINDOW = 120;
const FIXED_OVERLAP = 0.2; // 20% -> stride 96
const SENTENCE_TARGET = 100;
const SLIDING_WINDOW = 80;
const SLIDING_STRIDE = 40; // 50% overlap
const CHILD_WINDOW = 50;
const CHILD_OVERLAP = 10; // stride 40
const SEMANTIC_MIN_WORDS = 20; // segments smaller than this get merged forward

const segmenter = new Intl.Segmenter("en", { granularity: "sentence" });

function words(text: string): string[] {
  return text.trim().split(/\s+/).filter(Boolean);
}

export function sentences(text: string): string[] {
  const out: string[] = [];
  for (const s of segmenter.segment(text)) {
    const t = s.segment.trim();
    if (t) out.push(t);
  }
  return out.length ? out : [text.trim()];
}

function meta(
  p: CorpusPassage,
  strategy: ChunkStrategy,
  n: number,
  text: string,
  extra?: Partial<ChunkMeta>,
): ChunkMeta {
  return {
    id: `${strategy}:${p.queryId}:${p.passageIdx}:${n}`,
    strategy,
    queryId: p.queryId,
    passageIdx: p.passageIdx,
    isSelected: p.isSelected,
    queryType: p.queryType,
    langPair: p.langPair,
    text,
    ...extra,
  };
}

/** Fixed word window with a fractional overlap. */
function windowChunks(
  p: CorpusPassage,
  strategy: ChunkStrategy,
  window: number,
  stride: number,
  extra?: (n: number) => Partial<ChunkMeta>,
): ChunkMeta[] {
  const w = words(p.text);
  if (w.length <= window) return [meta(p, strategy, 0, p.text, extra?.(0))];
  const out: ChunkMeta[] = [];
  for (let i = 0, n = 0; i < w.length; i += stride, n++) {
    const slice = w.slice(i, i + window);
    // A trailing window shorter than the stride is fully contained in the
    // previous one — emitting it would only duplicate vectors.
    if (i > 0 && slice.length <= window - stride) break;
    out.push(meta(p, strategy, n, slice.join(" "), extra?.(n)));
    if (i + window >= w.length) break;
  }
  return out;
}

/** Greedy sentence packing: never splits a sentence, targets ~100 words. */
function sentenceChunks(p: CorpusPassage, target = SENTENCE_TARGET): ChunkMeta[] {
  const sents = sentences(p.text);
  const out: ChunkMeta[] = [];
  let buf: string[] = [];
  let count = 0;
  let n = 0;
  for (const s of sents) {
    const len = words(s).length;
    if (count > 0 && count + len > target) {
      out.push(meta(p, "sentence", n++, buf.join(" ")));
      buf = [];
      count = 0;
    }
    buf.push(s);
    count += len;
  }
  if (buf.length) out.push(meta(p, "sentence", n, buf.join(" ")));
  return out;
}

/**
 * Semantic chunking: embed every sentence, then cut the passage where the
 * cosine similarity between adjacent sentences falls below
 * `mean - 0.5 * std` of that passage's own adjacency similarities — a
 * per-passage threshold, so a uniformly on-topic passage stays whole while a
 * passage that pivots topics gets cut at the pivot. Tiny tail segments are
 * merged forward so we never index a 5-word fragment.
 */
async function semanticChunks(p: CorpusPassage): Promise<ChunkMeta[]> {
  const sents = sentences(p.text);
  if (sents.length < 3) return [meta(p, "semantic", 0, p.text)];
  return semanticSegment(p, sents, await embedPassages(sents));
}

/** Pure part of `semantic`: segmentation given sentences and their vectors. */
function semanticSegment(
  p: CorpusPassage,
  sents: string[],
  vecs: Float32Array[],
): ChunkMeta[] {
  const sims: number[] = [];
  for (let i = 1; i < vecs.length; i++) {
    let dot = 0;
    for (let d = 0; d < vecs[i].length; d++) dot += vecs[i][d] * vecs[i - 1][d];
    sims.push(dot);
  }
  const mean = sims.reduce((a, b) => a + b, 0) / sims.length;
  const std = Math.sqrt(sims.reduce((a, b) => a + (b - mean) ** 2, 0) / sims.length);
  const threshold = mean - 0.5 * std;

  // group sentences into segments, cutting at low-similarity boundaries
  const segments: string[][] = [[sents[0]]];
  for (let i = 1; i < sents.length; i++) {
    if (sims[i - 1] < threshold) segments.push([sents[i]]);
    else segments[segments.length - 1].push(sents[i]);
  }

  // merge segments under SEMANTIC_MIN_WORDS forward (last one merges back)
  const merged: string[][] = [];
  let carry: string[] = [];
  for (const seg of segments) {
    const cand = carry.concat(seg);
    if (words(cand.join(" ")).length < SEMANTIC_MIN_WORDS) {
      carry = cand;
      continue;
    }
    merged.push(cand);
    carry = [];
  }
  if (carry.length) {
    if (merged.length) merged[merged.length - 1].push(...carry);
    else merged.push(carry);
  }

  return merged.map((seg, n) => meta(p, "semantic", n, seg.join(" ")));
}

/**
 * Parent-document retrieval: index small, precise children but carry the full
 * passage on each one. VectorIndex.search dedupes children by parentId, so a
 * hit returns one entry whose parentText is the whole passage — precise
 * matching, complete context for the generator.
 */
function parentChunks(p: CorpusPassage): ChunkMeta[] {
  const parentId = `parent:${p.queryId}:${p.passageIdx}`;
  return windowChunks(p, "parent", CHILD_WINDOW, CHILD_WINDOW - CHILD_OVERLAP, () => ({
    parentId,
    parentText: p.text,
  }));
}

/**
 * Chunk one passage with one strategy. Always async because `semantic` needs
 * the embedder; the other four resolve synchronously.
 */
export async function chunkPassage(
  passage: CorpusPassage,
  strategy: ChunkStrategy,
): Promise<ChunkMeta[]> {
  switch (strategy) {
    case "fixed":
      return windowChunks(
        passage,
        "fixed",
        FIXED_WINDOW,
        Math.max(1, Math.round(FIXED_WINDOW * (1 - FIXED_OVERLAP))),
      );
    case "sentence":
      return sentenceChunks(passage);
    case "sliding":
      return windowChunks(passage, "sliding", SLIDING_WINDOW, SLIDING_STRIDE);
    case "semantic":
      return semanticChunks(passage);
    case "parent":
      return parentChunks(passage);
    default: {
      const never: never = strategy;
      throw new Error(`unknown strategy: ${never}`);
    }
  }
}

const SENT_BATCH = 64;

/**
 * Chunk many passages at once. Identical output to mapping `chunkPassage`, but
 * `semantic` embeds sentences across passage boundaries in batches of 64
 * instead of one ONNX call per passage. That matters: per-passage calls cost
 * ~30ms/passage at 6k passages but degraded to ~280ms/passage at 8k (ONNX
 * re-allocating for thousands of distinct input shapes), which made semantic
 * chunking superlinear. Batching keeps it flat.
 */
export async function chunkPassages(
  passages: CorpusPassage[],
  strategy: ChunkStrategy,
  onProgress?: (done: number, total: number) => void,
): Promise<ChunkMeta[]> {
  if (strategy !== "semantic") {
    const out: ChunkMeta[] = [];
    for (let i = 0; i < passages.length; i++) {
      out.push(...(await chunkPassage(passages[i], strategy)));
      onProgress?.(i + 1, passages.length);
    }
    return out;
  }

  // flatten every sentence of every passage, embed in fixed-size batches
  const sentsPer = passages.map((p) => sentences(p.text));
  const flat: string[] = [];
  for (let i = 0; i < passages.length; i++) {
    if (sentsPer[i].length >= 3) flat.push(...sentsPer[i]);
  }
  const vecs: Float32Array[] = new Array(flat.length);
  for (let i = 0; i < flat.length; i += SENT_BATCH) {
    const batch = await embedPassages(flat.slice(i, i + SENT_BATCH));
    for (let j = 0; j < batch.length; j++) vecs[i + j] = batch[j];
    onProgress?.(Math.min(i + SENT_BATCH, flat.length), flat.length);
  }

  const out: ChunkMeta[] = [];
  let cursor = 0;
  for (let i = 0; i < passages.length; i++) {
    const sents = sentsPer[i];
    if (sents.length < 3) {
      out.push(meta(passages[i], "semantic", 0, passages[i].text));
      continue;
    }
    out.push(...semanticSegment(passages[i], sents, vecs.slice(cursor, cursor + sents.length)));
    cursor += sents.length;
  }
  return out;
}
