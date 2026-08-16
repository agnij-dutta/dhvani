// Builds an IVF (inverted-file) layer over an existing quantized index:
// k-means centroids + per-cluster member lists. At query time the search
// scores K centroids and scans only the top-nprobe clusters — ~20x less work
// than the flat scan, which is what makes retrieval fast on tiny instances.
//
//   npx tsx scripts/build_ivf.ts --dir data/index-mini --k 192
//
// Writes into the index dir: ivf.json { k, dim, nprobe, lists } + centroids.f32
// (lists = row indices per cluster, referencing the existing strategy-sorted
// row order — vectors.q8/meta.jsonl are untouched, so the flat path still works.)

import { promises as fs } from "fs";
import path from "path";
import { VectorIndex } from "../src/lib/vindex";

const argv = process.argv.slice(2);
let dir = "data/index-mini";
let K = 192;
for (let i = 0; i < argv.length; i++) {
  if (argv[i] === "--dir") dir = argv[++i] ?? dir;
  else if (argv[i] === "--k") K = Number(argv[++i]) || K;
}

async function main() {
  const idx = await VectorIndex.load(dir);
  const { q8, scales } = idx.quantized;
  const dim = idx.dim;
  const n = idx.meta.length;

  // dequantize once into f32 for clustering (build-time only)
  const vecs = new Float32Array(n * dim);
  for (let r = 0; r < n; r++) {
    const s = scales[r];
    for (let d = 0; d < dim; d++) vecs[r * dim + d] = q8[r * dim + d] * s;
  }

  // k-means++ -lite init: spread seeds deterministically across the data
  const centroids = new Float32Array(K * dim);
  for (let c = 0; c < K; c++) {
    const r = Math.floor((c * n) / K);
    centroids.set(vecs.subarray(r * dim, (r + 1) * dim), c * dim);
  }

  const assign = new Int32Array(n);
  const ITERS = 12;
  const t0 = performance.now();
  for (let it = 0; it < ITERS; it++) {
    let moved = 0;
    for (let r = 0; r < n; r++) {
      let best = -1;
      let bestDot = -Infinity;
      for (let c = 0; c < K; c++) {
        let dot = 0;
        const co = c * dim;
        const ro = r * dim;
        for (let d = 0; d < dim; d++) dot += centroids[co + d] * vecs[ro + d];
        if (dot > bestDot) {
          bestDot = dot;
          best = c;
        }
      }
      if (assign[r] !== best) {
        assign[r] = best;
        moved++;
      }
    }
    // recompute centroids (mean, then L2-normalize to keep dot == cosine)
    centroids.fill(0);
    const counts = new Int32Array(K);
    for (let r = 0; r < n; r++) {
      const c = assign[r];
      counts[c]++;
      const co = c * dim;
      const ro = r * dim;
      for (let d = 0; d < dim; d++) centroids[co + d] += vecs[ro + d];
    }
    for (let c = 0; c < K; c++) {
      if (!counts[c]) continue;
      let norm = 0;
      const co = c * dim;
      for (let d = 0; d < dim; d++) norm += centroids[co + d] ** 2;
      norm = Math.sqrt(norm) || 1;
      for (let d = 0; d < dim; d++) centroids[co + d] /= norm;
    }
    console.log(`iter ${it + 1}/${ITERS}: ${moved} moved (${((performance.now() - t0) / 1000).toFixed(0)}s)`);
    if (moved < n * 0.005) break;
  }

  const lists: number[][] = Array.from({ length: K }, () => []);
  for (let r = 0; r < n; r++) lists[assign[r]].push(r);
  const sizes = lists.map((l) => l.length).sort((a, b) => a - b);
  console.log(`cluster sizes: min ${sizes[0]}, median ${sizes[K >> 1]}, max ${sizes[K - 1]}`);

  await fs.writeFile(path.join(dir, "centroids.f32"), Buffer.from(centroids.buffer));
  await fs.writeFile(path.join(dir, "ivf.json"), JSON.stringify({ k: K, dim, nprobe: 12, lists }));
  console.log(`IVF written: ${K} centroids over ${n} rows`);
}

main();
