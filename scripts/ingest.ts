// Build the on-disk vector index from data/corpus.jsonl.
//
//   npx tsx scripts/ingest.ts --strategies sentence,parent --limit 0
//
// Default strategies are the production pair: `sentence` (clean, whole-sentence
// context for the generator) + `parent` (precise child vectors that expand back
// to the full passage). Both live in one index; callers narrow with the
// `filter` argument of VectorIndex.search.

import { createReadStream } from "fs";
import { promises as fs } from "fs";
import readline from "readline";
import path from "path";
import { z } from "zod";
import type { ChunkMeta, ChunkStrategy } from "../src/lib/types";
import { embedPassages } from "../src/lib/embedder";
import { VectorIndex } from "../src/lib/vindex";
import { chunkPassages, STRATEGIES, type CorpusPassage } from "./chunking";

const MODEL = "Xenova/multilingual-e5-small";
const BATCH = 64;
const BLOCK = 5000; // passages chunked per pass before embedding

const passageSchema = z.object({
  id: z.string(),
  queryId: z.number(),
  passageIdx: z.number(),
  isSelected: z.number(),
  queryType: z.string(),
  langPair: z.string(),
  text: z.string(),
  engQuery: z.string(),
  engAnswer: z.string(),
});

interface Args {
  strategies: ChunkStrategy[];
  limit: number;
  corpus: string;
  out: string;
}

function parseArgs(argv: string[]): Args {
  const get = (flag: string): string | undefined => {
    const i = argv.indexOf(flag);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  const raw = (get("--strategies") ?? "sentence,parent").split(",").map((s) => s.trim());
  for (const s of raw) {
    if (!STRATEGIES.includes(s as ChunkStrategy)) {
      throw new Error(`unknown strategy "${s}" (have: ${STRATEGIES.join(",")})`);
    }
  }
  return {
    strategies: raw as ChunkStrategy[],
    limit: Number(get("--limit") ?? 0),
    corpus: get("--corpus") ?? "data/corpus.jsonl",
    out: get("--out") ?? process.env.INDEX_DIR ?? "data/index",
  };
}

/** Stream corpus.jsonl so we never hold the raw file and the parsed rows at once. */
export async function* readCorpus(file: string, limit = 0): AsyncGenerator<CorpusPassage> {
  const rl = readline.createInterface({
    input: createReadStream(file, { encoding: "utf8" }),
    crlfDelay: Infinity,
  });
  let n = 0;
  for await (const line of rl) {
    if (!line.trim()) continue;
    yield passageSchema.parse(JSON.parse(line)) as CorpusPassage;
    if (limit > 0 && ++n >= limit) {
      rl.close();
      break;
    }
  }
}

/** Embed `meta` in batches, appending vectors in place. Logs progress. */
export async function embedChunks(
  meta: ChunkMeta[],
  label: string,
  onBatch?: (done: number, total: number) => void,
): Promise<Float32Array[]> {
  const vectors: Float32Array[] = new Array(meta.length);
  const t0 = Date.now();
  for (let i = 0; i < meta.length; i += BATCH) {
    const slice = meta.slice(i, i + BATCH);
    const vecs = await embedPassages(slice.map((m) => m.text));
    for (let j = 0; j < vecs.length; j++) vectors[i + j] = vecs[j];
    const done = Math.min(i + BATCH, meta.length);
    if (onBatch) onBatch(done, meta.length);
    else if (done % (BATCH * 10) === 0 || done === meta.length) {
      const rate = done / ((Date.now() - t0) / 1000);
      const eta = (meta.length - done) / Math.max(rate, 1e-6);
      console.log(
        `[ingest] ${label} embedded ${done}/${meta.length} ` +
          `(${rate.toFixed(0)}/s, eta ${eta.toFixed(0)}s)`,
      );
    }
  }
  return vectors;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const t0 = Date.now();
  console.log(
    `[ingest] corpus=${args.corpus} strategies=${args.strategies.join(",")} ` +
      `limit=${args.limit || "all"} out=${args.out}`,
  );

  const meta: ChunkMeta[] = [];
  const perStrategy: Record<string, number> = {};
  const perStrategyWords: Record<string, number> = {};
  let passages = 0;
  const tChunk = Date.now();
  // Chunk in blocks rather than one passage at a time: keeps the corpus stream
  // (we never hold the whole file plus the parsed rows) while still letting the
  // semantic strategy batch its sentence embeddings across passages.
  let block: CorpusPassage[] = [];
  const flush = async (): Promise<void> => {
    for (const s of args.strategies) {
      for (const c of await chunkPassages(block, s)) {
        perStrategy[s] = (perStrategy[s] ?? 0) + 1;
        perStrategyWords[s] = (perStrategyWords[s] ?? 0) + c.text.split(/\s+/).length;
        meta.push(c);
      }
    }
    block = [];
  };
  for await (const p of readCorpus(args.corpus, args.limit)) {
    passages++;
    block.push(p);
    if (block.length >= BLOCK) {
      await flush();
      console.log(`[ingest] chunked ${passages} passages...`);
    }
  }
  if (block.length) await flush();
  const chunkMs = Date.now() - tChunk;
  console.log(
    `[ingest] ${passages} passages -> ${meta.length} chunks in ${(chunkMs / 1000).toFixed(1)}s`,
  );

  const tEmbed = Date.now();
  const vectors = await embedChunks(meta, "all");
  const embedMs = Date.now() - tEmbed;

  await VectorIndex.save(args.out, vectors, meta, MODEL);
  const bytes = (
    await Promise.all(
      ["vectors.f32", "meta.jsonl", "manifest.json"].map(async (f) =>
        (await fs.stat(path.join(args.out, f))).size,
      ),
    )
  ).reduce((a, b) => a + b, 0);

  console.log("[ingest] --- summary ---");
  for (const s of args.strategies) {
    const n = perStrategy[s] ?? 0;
    console.log(
      `[ingest]   ${s.padEnd(9)} ${String(n).padStart(7)} chunks  ` +
        `(${(n / passages).toFixed(2)} per passage, ` +
        `${(perStrategyWords[s] / Math.max(n, 1)).toFixed(1)} words avg)`,
    );
  }
  console.log(`[ingest]   total     ${String(meta.length).padStart(7)} chunks`);
  console.log(`[ingest]   index     ${(bytes / 1e6).toFixed(1)} MB at ${args.out}`);
  console.log(
    `[ingest]   timing    chunk ${(chunkMs / 1000).toFixed(1)}s + ` +
      `embed ${(embedMs / 1000).toFixed(1)}s = ${((Date.now() - t0) / 1000).toFixed(1)}s total`,
  );
}

const isMain = process.argv[1] && process.argv[1].endsWith("ingest.ts");
if (isMain) {
  main().catch((err) => {
    console.error("[ingest] failed:", err);
    process.exit(1);
  });
}
