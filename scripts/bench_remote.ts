// Drives the DEPLOYED instance: fires eval queries at /api/ask (text path)
// with pacing, then reads the server-side percentiles from /api/analytics.
// Client location doesn't matter — timings are measured inside the server.
//
//   npx tsx scripts/bench_remote.ts --url https://dhvani.onrender.com --n 100 --delay 6500

import { promises as fs } from "fs";

interface Args {
  url: string;
  n: number;
  delayMs: number;
}

function parseArgs(argv: string[]): Args {
  const args: Args = { url: "", n: 100, delayMs: 6500 };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--url") args.url = argv[++i] ?? "";
    else if (a === "--n") args.n = Number(argv[++i]) || args.n;
    else if (a === "--delay") args.delayMs = Number(argv[++i]) || args.delayMs;
  }
  if (!args.url) {
    console.error("usage: npx tsx scripts/bench_remote.ts --url <base-url> [--n 100] [--delay 6500]");
    process.exit(1);
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const base = args.url.replace(/\/$/, "");

  const raw = await fs.readFile("data/eval_queries.jsonl", "utf8");
  const queries: string[] = [];
  for (const line of raw.split("\n")) {
    if (!line.trim()) continue;
    const q = JSON.parse(line);
    if (typeof q.Eng_Query === "string" && q.Eng_Query.trim()) queries.push(q.Eng_Query.trim());
  }
  const picked = queries.slice(0, args.n);
  console.log(`remote bench: ${picked.length} queries → ${base}/api/ask (pacing ${args.delayMs}ms)`);

  const health = await fetch(`${base}/api/health`).then((r) => r.json());
  console.log(`health: index=${health?.index?.manifest?.count ?? "?"} vectors, providers:`, health?.providers);

  let ok = 0;
  let failed = 0;
  for (let i = 0; i < picked.length; i++) {
    try {
      const res = await fetch(`${base}/api/ask`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text: picked[i] }),
      });
      // drain the SSE stream fully so the server finishes and records timings
      if (res.body) for await (const _ of res.body) void _;
      if (res.ok) ok++;
      else failed++;
    } catch {
      failed++;
    }
    if ((i + 1) % 10 === 0) process.stdout.write(`\r  ${i + 1}/${picked.length}`);
    if (i < picked.length - 1) await new Promise((r) => setTimeout(r, args.delayMs));
  }
  console.log(`\n  done: ${ok} ok, ${failed} failed`);

  const analytics = await fetch(`${base}/api/analytics`).then((r) => r.json());
  console.log("\nserver-side percentiles (from /api/analytics):");
  console.log(JSON.stringify(analytics.overall, null, 2));
}

main();
