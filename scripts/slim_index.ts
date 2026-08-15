// Converts data/index (f32, all strategies) into a deploy-slim index at
// data/index-slim: pre-quantized int8 vectors, chosen strategies only.
// The slim format loads with no f32 memory spike — built for 512MB instances.
//
//   npx tsx scripts/slim_index.ts --strategies sentence --out data/index-slim

import { VectorIndex, type IndexManifest } from "../src/lib/vindex";

const argv = process.argv.slice(2);
let strategies = ["sentence"];
let out = "data/index-slim";
let src = "data/index";
for (let i = 0; i < argv.length; i++) {
  if (argv[i] === "--strategies") strategies = (argv[++i] ?? "").split(",").filter(Boolean);
  else if (argv[i] === "--out") out = argv[++i] ?? out;
  else if (argv[i] === "--src") src = argv[++i] ?? src;
}

async function main() {
  const idx = await VectorIndex.load(src);
  const { q8, scales } = idx.quantized;
  const dim = idx.dim;
  const keep = new Set(strategies);

  // rows are strategy-sorted, so the kept rows are contiguous runs
  const rows: number[] = [];
  for (let r = 0; r < idx.meta.length; r++) if (keep.has(idx.meta[r].strategy)) rows.push(r);
  if (!rows.length) throw new Error(`no rows for strategies: ${strategies.join(",")}`);

  const outQ8 = new Int8Array(rows.length * dim);
  const outScales = new Float32Array(rows.length);
  const outMeta = rows.map((r) => idx.meta[r]);
  rows.forEach((r, i) => {
    outQ8.set(q8.subarray(r * dim, (r + 1) * dim), i * dim);
    outScales[i] = scales[r];
  });

  const strategyCounts: Record<string, number> = {};
  for (const m of outMeta) strategyCounts[m.strategy] = (strategyCounts[m.strategy] ?? 0) + 1;
  const manifest: IndexManifest = {
    ...idx.manifest,
    count: rows.length,
    strategies: strategyCounts,
  };

  await VectorIndex.saveQuantized(out, outQ8, outScales, outMeta, manifest);
  console.log(`slim index: ${rows.length} rows (${strategies.join(",")}) → ${out}`);
  console.log(`vectors.q8 ${(outQ8.byteLength / 1e6).toFixed(1)}MB (was vectors.f32 ${(q8.length * 4 / 1e6).toFixed(1)}MB)`);
}

main();
