// In-process vector index. Embeddings are L2-normalized, so cosine == dot.
// Brute-force scan over a flat Float32Array: ~25k x 384 dims is a handful of
// milliseconds on modern CPUs — faster than any network round-trip to an
// external vector DB, which is the point of the <200ms budget.
//
// On-disk format (data/index/):
//   vectors.f32   — little-endian float32, rowMajor [count x dim]
//   meta.jsonl    — one ChunkMeta JSON object per line, same order as vectors
//   manifest.json — { count, dim, model, builtAt, strategies }

import { promises as fs } from "fs";
import path from "path";
import type { ChunkMeta, RetrievedChunk } from "./types";
import { EMBED_DIM } from "./embedder";

export interface IndexManifest {
  count: number;
  dim: number;
  model: string;
  builtAt: string;
  strategies: Record<string, number>;
}

export class VectorIndex {
  private constructor(
    public readonly vectors: Float32Array,
    public readonly meta: ChunkMeta[],
    public readonly manifest: IndexManifest,
  ) {}

  get dim(): number {
    return this.manifest.dim;
  }

  static async load(dir: string): Promise<VectorIndex> {
    const manifest: IndexManifest = JSON.parse(
      await fs.readFile(path.join(dir, "manifest.json"), "utf8"),
    );
    const buf = await fs.readFile(path.join(dir, "vectors.f32"));
    const vectors = new Float32Array(buf.buffer, buf.byteOffset, buf.byteLength / 4);
    const meta: ChunkMeta[] = (await fs.readFile(path.join(dir, "meta.jsonl"), "utf8"))
      .split("\n")
      .filter(Boolean)
      .map((l) => JSON.parse(l));
    if (meta.length !== manifest.count || vectors.length !== manifest.count * manifest.dim) {
      throw new Error(
        `index corrupt: manifest=${manifest.count}, meta=${meta.length}, vecs=${vectors.length / manifest.dim}`,
      );
    }
    const idx = new VectorIndex(vectors, meta, manifest);
    // page the mmap'd buffer into memory so the first real query doesn't pay it
    idx.search(new Float32Array(manifest.dim), 1);
    return idx;
  }

  static async save(
    dir: string,
    vectors: Float32Array[],
    meta: ChunkMeta[],
    model: string,
  ): Promise<void> {
    if (vectors.length !== meta.length) throw new Error("vectors/meta length mismatch");
    await fs.mkdir(dir, { recursive: true });
    const dim = vectors[0]?.length ?? EMBED_DIM;
    const flat = new Float32Array(vectors.length * dim);
    vectors.forEach((v, i) => flat.set(v, i * dim));
    const strategies: Record<string, number> = {};
    for (const m of meta) strategies[m.strategy] = (strategies[m.strategy] ?? 0) + 1;
    const manifest: IndexManifest = {
      count: meta.length,
      dim,
      model,
      builtAt: new Date().toISOString(),
      strategies,
    };
    await fs.writeFile(path.join(dir, "vectors.f32"), Buffer.from(flat.buffer));
    await fs.writeFile(path.join(dir, "meta.jsonl"), meta.map((m) => JSON.stringify(m)).join("\n"));
    await fs.writeFile(path.join(dir, "manifest.json"), JSON.stringify(manifest, null, 2));
  }

  /**
   * Exact top-k by dot product. `filter` optionally restricts by strategy.
   * Parent-strategy children are deduped to their parent, keeping best score.
   */
  search(query: Float32Array, k: number, filter?: (m: ChunkMeta) => boolean): RetrievedChunk[] {
    const { vectors, meta } = this;
    const dim = this.dim;
    const n = meta.length;
    // top-k via a small insertion buffer — k is tiny (<=20)
    const topIdx = new Int32Array(k).fill(-1);
    const topScore = new Float32Array(k).fill(-Infinity);
    for (let i = 0; i < n; i++) {
      if (filter && !filter(meta[i])) continue;
      const off = i * dim;
      let d0 = 0, d1 = 0, d2 = 0, d3 = 0;
      for (let d = 0; d < dim; d += 4) {
        d0 += vectors[off + d] * query[d];
        d1 += vectors[off + d + 1] * query[d + 1];
        d2 += vectors[off + d + 2] * query[d + 2];
        d3 += vectors[off + d + 3] * query[d + 3];
      }
      const dot = d0 + d1 + d2 + d3;
      if (dot <= topScore[k - 1]) continue;
      // insert
      let j = k - 1;
      while (j > 0 && topScore[j - 1] < dot) {
        topScore[j] = topScore[j - 1];
        topIdx[j] = topIdx[j - 1];
        j--;
      }
      topScore[j] = dot;
      topIdx[j] = i;
    }
    const out: RetrievedChunk[] = [];
    const seenParents = new Set<string>();
    for (let j = 0; j < k; j++) {
      const i = topIdx[j];
      if (i < 0) break;
      const m = meta[i];
      // dedupe by source passage so sentence- and parent-strategy chunks of
      // the same passage don't occupy multiple k slots
      const dedupeKey = `${m.queryId}:${m.passageIdx}`;
      if (seenParents.has(dedupeKey)) continue;
      seenParents.add(dedupeKey);
      out.push({ ...m, score: topScore[j] });
    }
    return out;
  }
}

// Process-wide singleton so the index survives across route invocations.
const globalStore = globalThis as unknown as { __dhvaniIndex?: Promise<VectorIndex> };

export function getIndex(dir = process.env.INDEX_DIR ?? "data/index"): Promise<VectorIndex> {
  if (!globalStore.__dhvaniIndex) {
    globalStore.__dhvaniIndex = VectorIndex.load(dir).catch((err) => {
      // don't memoize failures — the index may simply not be built yet
      globalStore.__dhvaniIndex = undefined;
      throw err;
    });
  }
  return globalStore.__dhvaniIndex;
}
