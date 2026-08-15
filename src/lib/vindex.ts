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
  /** int8-quantized vectors: 4x less memory traffic than f32 for the scan */
  private readonly q8: Int8Array;
  /** per-vector dequantization scale (maxAbs / 127) */
  private readonly scales: Float32Array;

  /** contiguous [start, end) row range per strategy (rows are strategy-sorted) */
  private readonly partitions: Map<string, [number, number]>;

  private constructor(
    q8: Int8Array,
    scales: Float32Array,
    public readonly meta: ChunkMeta[],
    public readonly manifest: IndexManifest,
  ) {
    this.q8 = q8;
    this.scales = scales;
    this.partitions = new Map();
    for (let r = 0; r < meta.length; r++) {
      const strat = meta[r].strategy;
      const range = this.partitions.get(strat);
      if (range) range[1] = r + 1;
      else this.partitions.set(strat, [r, r + 1]);
    }
  }

  // The f32 source is quantized then released — only q8 + scales are retained,
  // which cuts resident memory ~4x (matters on small deploy instances).
  // Rows are physically reordered so each strategy occupies a contiguous
  // range, letting search scan a strategy subset with zero per-row branching.
  static fromF32(vectors: Float32Array, meta: ChunkMeta[], manifest: IndexManifest): VectorIndex {
    const { count, dim } = manifest;
    const order = Array.from({ length: count }, (_, i) => i).sort((a, b) =>
      meta[a].strategy < meta[b].strategy ? -1 : meta[a].strategy > meta[b].strategy ? 1 : a - b,
    );
    const sortedMeta = order.map((i) => meta[i]);
    const q8 = new Int8Array(count * dim);
    const scales = new Float32Array(count);
    for (let r = 0; r < count; r++) {
      const src = order[r] * dim;
      const dst = r * dim;
      let maxAbs = 1e-12;
      for (let d = 0; d < dim; d++) {
        const a = Math.abs(vectors[src + d]);
        if (a > maxAbs) maxAbs = a;
      }
      const s = maxAbs / 127;
      scales[r] = s;
      const inv = 1 / s;
      for (let d = 0; d < dim; d++) q8[dst + d] = Math.round(vectors[src + d] * inv);
    }
    return new VectorIndex(q8, scales, sortedMeta, manifest);
  }

  get dim(): number {
    return this.manifest.dim;
  }

  static async load(dir: string): Promise<VectorIndex> {
    const manifest: IndexManifest = JSON.parse(
      await fs.readFile(path.join(dir, "manifest.json"), "utf8"),
    );
    const meta: ChunkMeta[] = (await fs.readFile(path.join(dir, "meta.jsonl"), "utf8"))
      .split("\n")
      .filter(Boolean)
      .map((l) => JSON.parse(l));
    if (meta.length !== manifest.count) {
      throw new Error(`index corrupt: manifest=${manifest.count}, meta=${meta.length}`);
    }

    let idx: VectorIndex;
    const q8Path = path.join(dir, "vectors.q8");
    if (await fs.stat(q8Path).then(() => true, () => false)) {
      // pre-quantized format: no f32 memory spike at load — rows are already
      // strategy-sorted (written by saveQuantized)
      const q8buf = await fs.readFile(q8Path);
      const sbuf = await fs.readFile(path.join(dir, "scales.f32"));
      const q8 = new Int8Array(q8buf.buffer, q8buf.byteOffset, q8buf.byteLength);
      const scales = new Float32Array(sbuf.buffer, sbuf.byteOffset, sbuf.byteLength / 4);
      if (q8.length !== manifest.count * manifest.dim || scales.length !== manifest.count) {
        throw new Error(`index corrupt: q8=${q8.length}, scales=${scales.length}`);
      }
      idx = new VectorIndex(q8, scales, meta, manifest);
    } else {
      const buf = await fs.readFile(path.join(dir, "vectors.f32"));
      const vectors = new Float32Array(buf.buffer, buf.byteOffset, buf.byteLength / 4);
      if (vectors.length !== manifest.count * manifest.dim) {
        throw new Error(`index corrupt: vecs=${vectors.length / manifest.dim}`);
      }
      idx = VectorIndex.fromF32(vectors, meta, manifest);
    }
    // page the buffers in so the first real query doesn't pay it
    idx.search(new Float32Array(manifest.dim), 1);
    return idx;
  }

  /** Write the compact pre-quantized format (rows must be strategy-sorted). */
  static async saveQuantized(
    dir: string,
    q8: Int8Array,
    scales: Float32Array,
    meta: ChunkMeta[],
    manifest: IndexManifest,
  ): Promise<void> {
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path.join(dir, "vectors.q8"), Buffer.from(q8.buffer, q8.byteOffset, q8.byteLength));
    await fs.writeFile(
      path.join(dir, "scales.f32"),
      Buffer.from(scales.buffer, scales.byteOffset, scales.byteLength),
    );
    await fs.writeFile(path.join(dir, "meta.jsonl"), meta.map((m) => JSON.stringify(m)).join("\n"));
    await fs.writeFile(path.join(dir, "manifest.json"), JSON.stringify(manifest, null, 2));
  }

  /** internal buffers, exposed for the index converter script */
  get quantized(): { q8: Int8Array; scales: Float32Array } {
    return { q8: this.q8, scales: this.scales };
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
  /**
   * Exact top-k by (quantized) dot product. `strategies` restricts the scan to
   * those partitions; omit to scan everything. Results are deduped to distinct
   * source passages.
   */
  search(query: Float32Array, k: number, strategies?: string[]): RetrievedChunk[] {
    const { q8, scales, meta } = this;
    const dim = this.dim;
    // resolve scan ranges: whole index, or the requested strategy partitions
    const ranges: [number, number][] = [];
    if (strategies?.length) {
      for (const s of strategies) {
        const r = this.partitions.get(s);
        if (r) ranges.push(r);
      }
      if (!ranges.length) return [];
    } else {
      ranges.push([0, meta.length]);
    }
    // top-k via a small insertion buffer — k is tiny (<=20)
    const topIdx = new Int32Array(k).fill(-1);
    const topScore = new Float32Array(k).fill(-Infinity);
    for (const [lo, hi] of ranges)
    for (let i = lo; i < hi; i++) {
      const off = i * dim;
      let d0 = 0, d1 = 0, d2 = 0, d3 = 0;
      for (let d = 0; d < dim; d += 4) {
        d0 += q8[off + d] * query[d];
        d1 += q8[off + d + 1] * query[d + 1];
        d2 += q8[off + d + 2] * query[d + 2];
        d3 += q8[off + d + 3] * query[d + 3];
      }
      const dot = (d0 + d1 + d2 + d3) * scales[i];
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
