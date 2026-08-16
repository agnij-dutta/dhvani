# Dhvani ध्वनि — Voice-Enabled RAG over MSMARCO-XI

**HH Goa 2026 · Shortlisting Task 2**

Speak a question in English or any of 22 Indic languages. Dhvani transcribes it
with **Sarvam**, retrieves grounded context from the
[ai4bharat/MSMARCO-XI](https://huggingface.co/datasets/ai4bharat/MSMARCO-XI)
dataset, and streams back a cited answer — with every millisecond of the
pipeline accounted for, live, on screen.

```
voice ──► Sarvam STT-translate ──► guardrails ──► local ONNX embed ──► in-process
          (saaras, 22 langs→en)     (<1ms)        (multilingual-e5,     vector index
                                                   ~2ms)                (~20ms, 62,872 vecs)
                                                                            │
   SSE stream ◄── grounding check ◄── Groq llama-3.1-8b (Gemini fallback) ◄─┘
```

**Live demo:** https://dhvani-rpf3.onrender.com (free-tier instance — see the
latency-by-environment note below) · analytics at `/analytics`

## Measured latency (150 real MS MARCO queries, Apple M4, nearest-rank percentiles)

| stage | P50 | P70 | P90 | P100 |
|---|---:|---:|---:|---:|
| guard | 0.0ms | 0.0ms | 0.0ms | 2.1ms |
| embed (query) | 1.7ms | 1.9ms | 2.2ms | 3.8ms |
| retrieve (62,872 vectors, exact) | 20.0ms | 20.1ms | 20.1ms | 27.4ms |
| **retrieval path (guard+embed+retrieve)** | **21.8ms** | **21.9ms** | **22.3ms** | **30.8ms** |

The retrieval path leaves ~178ms of the 200ms budget for the LLM's first
token. Full per-query numbers (including TTFT and STT once API keys are set)
are recorded to `data/analytics.jsonl` on every request and aggregated at
`/analytics`. Reproduce with `npx tsx scripts/bench.ts --n 150` — results land
in `data/bench_results.md`.

### Latency by environment (measured, not projected)

The pipeline is CPU-bound in exactly two places (query embed, vector scan), so
where it runs matters. Same code, three environments, all measured with
`scripts/bench.ts` / `scripts/bench_remote.ts` over real dataset queries:

| environment | embed P50 | retrieve P50 | TTFT P50 | ragMs P50 |
|---|---:|---:|---:|---:|
| Apple M4, retrieval path only | 1.7ms | 20.0ms | — | **21.8ms** |
| Apple M4 + Groq generation (from India) | 8.8ms | 18.9ms | 218ms | 253ms |
| Render free tier, 0.1 vCPU (live link) | ~100ms | **2.8ms** (IVF) | ~300-410ms | ~400-620ms |

The free instance is 0.1 of a shared vCPU — a ~50x CPU handicap that scales
every CPU-bound stage equally; the code path is identical. On any normal
machine the retrieval path is ~22ms, and warm single-query runs with
generation land ~150ms ragMs (measured end-to-end voice → answer at 459ms
total including STT). Per-query stage timings for every request against the
live instance are recorded server-side and visible at `/analytics`.

**Why it's fast:** no network hop anywhere in the retrieval path. Embeddings
run in-process (quantized ONNX, `Xenova/multilingual-e5-small`), and the vector
index is a flat `Float32Array` scanned with an unrolled exact dot product —
the flat scan is exact brute force, and an optional IVF layer (192 k-means
centroids, nprobe 24, ~90 lines of TS in `scripts/build_ivf.ts`) cuts search
another 14x (9.7ms → 0.7ms on M4; 708ms → 2.8ms on a 0.1-vCPU instance) at a
cost of 2 points of R@5 — both paths ship, the loader picks IVF when present.

## Chunking: five strategies, honestly evaluated

Ingestion (`scripts/ingest.ts`) supports five real strategies, all
metadata-aware (each chunk carries query_id, passage_idx, `is_selected`
relevance label, query_type, language pair):

1. **fixed** — ~120-word windows, 20% overlap (baseline)
2. **sentence** — `Intl.Segmenter` sentence packing to ~100 words, never splits a sentence
3. **sliding** — 80-word window, 40-word stride (50% overlap)
4. **semantic** — embedding-based: split where adjacent-sentence cosine similarity drops below mean − 0.5σ
5. **parent-document** — ~50-word children indexed for precision, retrieval returns the full parent passage for generation context

`scripts/eval_chunking.ts` benchmarks all five on Recall@1/5/10 against MS
MARCO's `is_selected` labels, with each gold passage's nine sibling passages
kept as hard same-topic distractors. Full table and analysis in
[`data/chunking_eval.md`](data/chunking_eval.md) — headline: on MS MARCO the
strategies converge (passages are already chunk-sized, median 49 words), which
is itself the finding; production ships `sentence + parent` and retrieval
dedupes to distinct source passages so both strategies compete for the same k
slots without duplicating context.

## Harness

`src/server/pipeline.ts` orchestrates typed stages (zod-validated external
I/O throughout): STT → input guard → embed → retrieve → generate → grounding.
Every stage is individually timed, individually try/caught, and streamed to
the client as SSE events — a stage failure emits a structured error, never a
dropped connection. Generation runs a provider fallback chain (Groq
`llama-3.1-8b-instant` → Gemini `gemini-2.5-flash-lite`) with retries with
exponential backoff on the STT client (5xx/429 only, 10s timeout).

## Guardrails — knowing when *not* to answer

1. **Input guard** (<1ms): empty/short queries, unsafe-content lexicon
   (violence-instruction, self-harm, CSAM, slurs), prompt-injection patterns.
2. **Off-topic gate**: if the best retrieval score is below the calibrated
   threshold (default 0.80 — e5 similarities are range-compressed: unrelated
   ≈0.74, related ≈0.89; `OFF_TOPIC_THRESHOLD` to tune), Dhvani refuses and
   shows the weak evidence rather than hallucinating.
3. **Grounding check**: generation is prompted to answer *only* from numbered
   context and reply `NOT_IN_CONTEXT` otherwise; the final answer is then
   scored for content-word overlap with the retrieved passages — ungrounded
   answers are replaced with a refusal, and the grounding score is shown in
   the UI.

Each refusal reason gets its own UI state; refusals are recorded in analytics.

## Running it

```bash
npm install
cp .env.example .env.local   # add SARVAM_API_KEY, GROQ_API_KEY (and/or GEMINI_API_KEY)

# one-time: build the index (or use the prebuilt data/ if present)
/path/to/python scripts/sample_dataset.py --rows 2500   # needs pyarrow + the parquet shard
npx tsx scripts/ingest.ts --strategies sentence,parent

npm run dev                  # UI at localhost:3000, analytics at /analytics
npx tsx scripts/bench.ts --n 150        # latency percentiles
npx tsx scripts/eval_chunking.ts        # chunking strategy comparison
```

`GET /api/health` reports index/manifest, embedder warmth, and configured
providers. `POST /api/ask` accepts multipart audio or JSON `{text}` and
streams SSE `AskEvent`s (contract in `src/lib/types.ts`).

## Lineage

The audio capture layer (MIME negotiation ladder, live RMS metering,
push-to-talk resilience) is salvaged and modernized from
[attack_capital](https://github.com/agnij-dutta/attack_capital), a real-time
meeting transcription app — rebuilt here around a sub-second utterance flow
instead of 30-second batch transcription, with the RAG layer (chunking,
embeddings, vector index, harness, guardrails) built new for this task.
