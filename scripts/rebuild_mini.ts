// Re-embeds the slim (sentence-only) index with the deploy embedder
// (EMBED_MODEL, e.g. Xenova/all-MiniLM-L6-v2) and writes a pre-quantized
// index. Reuses the chunk texts/metadata from an existing index dir.
//
//   EMBED_MODEL=Xenova/all-MiniLM-L6-v2 npx tsx scripts/rebuild_mini.ts \
//     --src data/index-slim --out data/index-mini

import { VectorIndex, type IndexManifest } from "../src/lib/vindex";
import { embedPassages, warmup } from "../src/lib/embedder";

const argv = process.argv.slice(2);
let src = "data/index-slim";
let out = "data/index-mini";
for (let i = 0; i < argv.length; i++) {
  if (argv[i] === "--src") src = argv[++i] ?? src;
  else if (argv[i] === "--out") out = argv[++i] ?? out;
}

async function main() {
  const model = process.env.EMBED_MODEL;
  if (!model) throw new Error("set EMBED_MODEL to the target embedder");
  await warmup();
  const idx = await VectorIndex.load(src);
  const meta = idx.meta;
  const dim = idx.dim;
  console.log(`re-embedding ${meta.length} chunks with ${model}...`);

  const q8 = new Int8Array(meta.length * dim);
  const scales = new Float32Array(meta.length);
  const BATCH = 64;
  const t0 = performance.now();
  for (let i = 0; i < meta.length; i += BATCH) {
    const batch = meta.slice(i, i + BATCH);
    const vecs = await embedPassages(batch.map((m) => m.text));
    vecs.forEach((v, j) => {
      if (v.length !== dim) throw new Error(`dim mismatch: ${v.length} != ${dim}`);
      const r = i + j;
      let maxAbs = 1e-12;
      for (const x of v) if (Math.abs(x) > maxAbs) maxAbs = Math.abs(x);
      const s = maxAbs / 127;
      scales[r] = s;
      const inv = 1 / s;
      for (let d = 0; d < dim; d++) q8[r * dim + d] = Math.round(v[d] * inv);
    });
    if ((i / BATCH) % 20 === 0) {
      const pct = ((i / meta.length) * 100).toFixed(0);
      console.log(`  ${pct}% (${((performance.now() - t0) / 1000).toFixed(0)}s)`);
    }
  }

  const manifest: IndexManifest = { ...idx.manifest, model, builtAt: new Date().toISOString() };
  await VectorIndex.saveQuantized(out, q8, scales, meta, manifest);
  console.log(`done in ${((performance.now() - t0) / 1000).toFixed(0)}s → ${out}`);
}

main();
