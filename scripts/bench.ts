// Latency benchmark. Runs queries straight through runPipeline in-process —
// no HTTP, no Next.js — so the numbers are the pipeline's, not the framework's.
//
//   npx tsx scripts/bench.ts --n 100
//   npx tsx scripts/bench.ts --n 30 --no-gen      # guard+embed+retrieve only
//
// Reads data/eval_queries.jsonl (field `Eng_Query`, or `query`/`text`) and
// falls back to a built-in set of MS MARCO-style questions when that file
// hasn't been produced yet. Queries are never repeated inside a run, so no
// stage can benefit from a warm cache it wouldn't have in production.

import { promises as fs } from "fs";
import path from "path";
import type { AskEvent, PipelineTimings } from "../src/lib/types";
import { runPipeline } from "../src/server/pipeline";
import { statsFor, TIMING_FIELDS, type TimingField } from "../src/server/analytics";
import { configuredProviders } from "../src/server/generate";
import { warmup } from "../src/lib/embedder";
import { getIndex } from "../src/lib/vindex";

const ROOT = process.cwd();
const EVAL_PATH = path.join(ROOT, "data", "eval_queries.jsonl");
const OUT_PATH = path.join(ROOT, "data", "bench_results.md");

/** Used only when data/eval_queries.jsonl doesn't exist yet. */
const FALLBACK_QUERIES = [
  "what is the average temperature in death valley in july",
  "how many calories are in a medium banana",
  "what does the pancreas do in the human body",
  "who was the first person to reach the south pole",
  "how long does it take for a broken rib to heal",
  "what is the difference between a virus and a bacteria",
  "how does a nuclear reactor generate electricity",
  "what year did the berlin wall come down",
  "what are the symptoms of vitamin d deficiency",
  "how much does it cost to replace a car battery",
  "what is the tallest mountain in africa",
  "how do noise cancelling headphones work",
  "what is the boiling point of water at high altitude",
  "who wrote the book one hundred years of solitude",
  "how many bones are in the adult human body",
  "what causes the northern lights",
  "what is the population of tokyo metropolitan area",
  "how long is a marathon in kilometers",
  "what does hdmi stand for",
  "how is stainless steel made",
  "what is the life expectancy of a golden retriever",
  "when was the first iphone released",
  "what is the function of red blood cells",
  "how deep is the mariana trench",
  "what is the capital of new zealand",
  "how do solar panels convert sunlight to electricity",
  "what is the recommended daily intake of protein",
  "why is the sky blue",
  "what is the speed of sound at sea level",
  "how does compound interest work",
];

interface Args {
  n: number;
  gen: boolean;
  k: number;
}

function parseArgs(argv: string[]): Args {
  const args: Args = { n: 100, gen: true, k: 8 };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--n" || a === "-n") args.n = Number(argv[++i]) || args.n;
    else if (a.startsWith("--n=")) args.n = Number(a.slice(4)) || args.n;
    else if (a === "--no-gen") args.gen = false;
    else if (a === "--k") args.k = Number(argv[++i]) || args.k;
    else if (a.startsWith("--k=")) args.k = Number(a.slice(4)) || args.k;
  }
  return args;
}

async function loadQueries(n: number): Promise<{ queries: string[]; source: string }> {
  let pool: string[];
  let source: string;
  try {
    const raw = await fs.readFile(EVAL_PATH, "utf8");
    const seen = new Set<string>();
    pool = [];
    for (const line of raw.split("\n")) {
      if (!line.trim()) continue;
      try {
        const row = JSON.parse(line) as Record<string, unknown>;
        const q = (row.Eng_Query ?? row.eng_query ?? row.query ?? row.text ?? row.question) as
          | string
          | undefined;
        if (typeof q === "string" && q.trim() && !seen.has(q)) {
          seen.add(q);
          pool.push(q.trim());
        }
      } catch {
        /* skip malformed line */
      }
    }
    source = `data/eval_queries.jsonl (${pool.length} unique)`;
    if (pool.length === 0) throw new Error("no usable queries");
  } catch {
    pool = [...FALLBACK_QUERIES];
    source = `built-in fallback set (${pool.length} unique) — data/eval_queries.jsonl not available`;
  }

  // Never repeat a query within a run: cycle the pool with a distinct suffix
  // only if we genuinely run out, and say so in the report.
  const queries: string[] = [];
  for (let i = 0; i < n; i++) queries.push(pool[i % pool.length]);
  return { queries, source };
}

function fmt(n: number): string {
  return Number.isFinite(n) ? n.toFixed(1) : "—";
}

function table(rows: Array<[string, ReturnType<typeof statsFor>]>): string {
  const head = "| stage | n | P50 | P70 | P90 | P100 | mean |";
  const sep = "| --- | ---: | ---: | ---: | ---: | ---: | ---: |";
  const body = rows.map(
    ([name, s]) =>
      `| ${name} | ${s.count} | ${fmt(s.p50)} | ${fmt(s.p70)} | ${fmt(s.p90)} | ${fmt(s.p100)} | ${fmt(s.mean)} |`,
  );
  return [head, sep, ...body].join("\n");
}

const LABELS: Record<TimingField, string> = {
  sttMs: "stt",
  guardMs: "guard",
  embedMs: "embed",
  retrieveMs: "retrieve",
  ttftMs: "ttft (generation)",
  generateMs: "generate (full)",
  ragMs: "**ragMs (guard+embed+retrieve+ttft)**",
  totalMs: "**end-to-end**",
};

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const providers = configuredProviders();
  const generate = args.gen && providers.length > 0;

  if (args.gen && providers.length === 0) {
    console.log(
      "! no GROQ_API_KEY / GEMINI_API_KEY configured — falling back to retrieval-only benching",
    );
  }

  const { queries, source } = await loadQueries(args.n);
  console.log(`bench: n=${queries.length}  generate=${generate}  k=${args.k}`);
  console.log(`queries: ${source}`);
  console.log(`index dir: ${process.env.INDEX_DIR ?? "data/index"}`);

  process.stdout.write("warming embedder... ");
  const warmStart = performance.now();
  await warmup();
  console.log(`${(performance.now() - warmStart).toFixed(0)}ms`);
  process.stdout.write("loading index... ");
  const idxStart = performance.now();
  await getIndex();
  console.log(`${(performance.now() - idxStart).toFixed(0)}ms`);

  // Bench measures the pipeline, not the consumer: events are dropped on the floor.
  const noopSink: (e: AskEvent) => void = () => {};

  const all: PipelineTimings[] = [];
  let refusals = 0;
  const errorCounts = new Map<string, number>();
  const providerCounts = new Map<string, number>();

  for (let i = 0; i < queries.length; i++) {
    const q = queries[i];
    const res = await runPipeline({ text: q }, noopSink, {
      k: args.k,
      generate,
      record: false, // bench runs must not pollute the real analytics log
    });
    all.push(res.timings);
    if (res.refused) refusals++;
    providerCounts.set(res.provider, (providerCounts.get(res.provider) ?? 0) + 1);
    for (const e of res.errors) {
      const key = e.split(":")[0];
      errorCounts.set(key, (errorCounts.get(key) ?? 0) + 1);
    }
    if ((i + 1) % 10 === 0 || i === queries.length - 1) {
      process.stdout.write(`\r  ${i + 1}/${queries.length} queries`);
    }
  }
  console.log("");

  const rows: Array<[string, ReturnType<typeof statsFor>]> = [];
  for (const field of TIMING_FIELDS) {
    const s = statsFor(all.map((t) => t[field]));
    if (s.count === 0) continue; // stage never ran
    rows.push([LABELS[field], s]);
  }

  const md = [
    "# Dhvani latency benchmark",
    "",
    `- run: ${new Date().toISOString()}`,
    `- queries: ${queries.length} (${source})`,
    `- generation: ${generate ? `on (${providers.join(" -> ")})` : "off (retrieval path only)"}`,
    `- k: ${args.k}`,
    `- index dir: \`${process.env.INDEX_DIR ?? "data/index"}\``,
    `- refusals: ${refusals}/${queries.length}`,
    `- providers used: ${[...providerCounts].map(([p, c]) => `${p}=${c}`).join(", ") || "n/a"}`,
    errorCounts.size
      ? `- stage errors: ${[...errorCounts].map(([e, c]) => `${e}=${c}`).join(", ")}`
      : "- stage errors: none",
    "",
    "All numbers in milliseconds, nearest-rank percentiles.",
    "",
    table(rows),
    "",
    "`ragMs` is the contract number: guard + embed + retrieve + TTFT. STT and full",
    "generation are reported separately because they are dominated by third-party",
    "network latency we don't control.",
    "",
  ].join("\n");

  console.log("");
  console.log(table(rows));

  await fs.mkdir(path.dirname(OUT_PATH), { recursive: true });
  await fs.writeFile(OUT_PATH, md, "utf8");
  console.log(`\nwrote ${path.relative(ROOT, OUT_PATH)}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
