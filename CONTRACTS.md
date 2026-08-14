# Dhvani — internal build contracts

Voice-enabled RAG over ai4bharat/MSMARCO-XI for HH Goa 2026 Task 2.
Pipeline: voice → Sarvam STT (saaras, translates 22 Indic langs → English) →
guardrails → local ONNX embed (multilingual-e5-small, 384d) → in-process
vector index → Groq generation (Gemini fallback) → grounding check → SSE out.

Hard requirements: retrieval-path latency (guard+embed+retrieve+TTFT) < 200ms
target; P50/P70/P100 analytics; multi-strategy chunking; harness with retries,
typed I/O, fallbacks; guardrails that refuse off-topic/unsafe/ungrounded.

## Fixed shared modules (already written — build against, do not rewrite)

- `src/lib/types.ts` — all shared types incl. SSE `AskEvent` contract.
- `src/lib/embedder.ts` — `embedQuery`, `embedPassages`, `warmup`, `EMBED_DIM`.
- `src/lib/vindex.ts` — `VectorIndex.load/save/search`, `getIndex()` singleton.
  Index dir: `data/index/` (vectors.f32 + meta.jsonl + manifest.json).

## File layout / ownership

- `scripts/sample_dataset.py` + `scripts/ingest.ts` + `scripts/eval_chunking.ts` — ingestion (Agent A)
  - raw parquet at `/Users/agnijdutta/Desktop/_hhgoa_data/val_0.parquet`
    (97,941 rows; fields: query, Eng_Query, Answer, Eng_Answer, query_id,
    query_type, source_lang, target_lang, passages{English_passages[10],
    Translated_passages[10], is_selected[10]})
  - python venv with pyarrow: `/Users/agnijdutta/Desktop/_hhgoa_data/venv/bin/python`
  - Output of sampling: `data/corpus.jsonl` (one row per unique passage after dedupe)
  - Run TS scripts with `npx tsx`.
- `src/server/*` — pipeline harness, providers, guardrails, analytics (Agent B)
  - `src/server/sarvam.ts`, `src/server/generate.ts`, `src/server/guardrails.ts`,
    `src/server/pipeline.ts`, `src/server/analytics.ts`
- `src/app/api/*` — routes (Agent B): `api/ask` (POST audio|text, SSE out),
  `api/analytics` (GET stats), `api/health` (GET index+model status)
- `src/app/*` pages + `src/components/*` — UI (Agent C)
- `scripts/bench.ts` — latency benchmark (Agent B)

## Env vars (.env.local, see .env.example)

- `SARVAM_API_KEY` (header `api-subscription-key`)
- `GROQ_API_KEY` (primary generation: `llama-3.1-8b-instant`)
- `GEMINI_API_KEY` (fallback generation: `gemini-2.5-flash-lite`)
- `INDEX_DIR` (default `data/index`), `HF_CACHE_DIR` (default `./.hf-cache`)

## API contract

`POST /api/ask` — multipart (`audio` file) OR JSON `{ text: string }` (text
path skips STT; used by bench + typed fallback). Response: `text/event-stream`,
each event `data: <JSON AskEvent>\n\n`, in this order: stage events
interleaved, `transcript`, (`guardrail` if refused → then `done`), `chunks`,
`token`*, `grounding`, `done`.

`GET /api/analytics` → `{ overall: LatencyStats-per-field, recent: AnalyticsRecord[] }`
computed from `data/analytics.jsonl` (append-only, one AnalyticsRecord per line).

## Latency accounting (single source of truth)

`ragMs = guardMs + embedMs + retrieveMs + ttftMs` — this is the <200ms number.
STT and full generation are reported separately and honestly. Bench uses the
text path with real dataset queries (never the same string twice in cache).

## Style

TypeScript strict, zod-validate all external I/O (Sarvam/Groq responses, route
bodies). No new heavy deps without need. Errors never crash the stream —
always emit `{type:"error"}` then close.
