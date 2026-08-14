# Chunking strategy evaluation

Corpus slice: **8140 passages** from `data/corpus.jsonl` (first 6000 as
distractors + every gold passage **and its nine sibling passages from the same
MS MARCO query**, so every query is answerable and each one keeps its hardest,
same-topic distractors).
Queries: **300** MS MARCO English queries with at least one
`is_selected` passage. Embedder: `Xenova/multilingual-e5-small` (384d, q8 ONNX),
query embedding ~3.9ms (shared across strategies, excluded
from the latency column).

A query counts as a hit at *k* if any of the top-*k* **distinct source passages**
returned is one MS MARCO marked as selected for it.

| strategy | chunks | chunks/passage | avg words | R@1 | R@5 | R@10 | search p50 | search p95 | build |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `fixed` | 8218 | 1.01 | 51.7 | 40.3% | 90.0% | 99.3% | 3.29ms | 3.81ms | 138.2s |
| `sentence` | 8409 | 1.03 | 50.3 | 43.0% | 89.7% | 99.3% | 3.09ms | 3.95ms | 129.1s |
| `sliding` | 8991 | 1.10 | 50.8 | 42.0% | 90.0% | 99.3% | 3.61ms | 5.30ms | 144.1s |
| `semantic` | 9895 | 1.22 | 42.8 | 42.0% | 91.7% | 99.7% | 3.79ms | 5.23ms | 312.9s |
| `parent` | 12247 | 1.50 | 37.9 | 42.0% | 91.7% | 99.3% | 7.29ms | 10.83ms | 170.9s |

## Reading the table

**The honest headline: on this dataset the five strategies are statistically
indistinguishable.**
The R@1 spread is 2.7 percentage points around a 41.9% base; the
standard error on a 300-query binomial at that rate is ±2.8pp, so a spread
that small is noise. Reporting a winner from these numbers alone over-reads them.

That result has a concrete cause, not a shrug. MSMARCO-XI passages are short —
median 49 words, p90 81, max 249 in the 24.6k-passage sample. Every strategy
whose window is at or above ~100 words therefore emits **one** chunk for the
large majority of passages (`fixed` 1.01, `sentence` 1.03 chunks/passage), so
on most passages those strategies are literally producing the same vector from
the same text. Chunking can only differentiate where there is something to cut,
and MS MARCO passages are already chunk-sized: the dataset was built by
retrieving passages. The strategies would separate on 1-5k-word documents;
here the long tail is too thin to move a 300-query metric.

Second-order effects the table does show:

- Granularity is real even if recall is flat. `parent` produces 1.50 vectors per
  passage against `fixed`'s 1.01 — a ~50% larger index and scan cost for no
  measured recall gain. That is a live cost against the <200ms budget.
- Latency tracks vector count, as a brute-force dot-product scan should: the
  scan stays in single-digit ms at this size, which is the entire argument for
  keeping the index in-process instead of paying a network hop to a vector DB.
- `semantic` is by far the most expensive to build: it embeds every sentence
  just to decide where to cut, i.e. it pays the full embedding bill twice.
  A first version did this one passage at a time and went superlinear
  (~30ms/passage at 6k passages, ~280ms/passage at 8k, as ONNX re-allocated
  for thousands of distinct input shapes); `chunkPassages` now batches
  sentences across passages at 64/call, which flattens it. Even so it buys
  nothing measurable here — first thing to cut, first thing to revisit on
  long-form documents.
- Recall@10 lands at ~99% for everyone, so the discriminating metric here is
  R@1 — which is also the metric that matters for a voice answer, since the
  generator reads from very few chunks and the user hears one answer.

Production choice is `sentence` + `parent` in one index (`npx tsx
scripts/ingest.ts --strategies sentence,parent`) — chosen on *context quality*,
not on this recall table, because the table does not justify a preference.
`parent` children give a precise small-vector match while
`VectorIndex.search` dedupes them by `parentId` and hands the generator
`parentText`, the whole passage, so precision at retrieval does not degrade
into a 50-word fragment at generation. `sentence` chunks sit alongside as a
whole-passage variant that never cuts mid-sentence. The pair costs ~2.5
vectors/passage; if index scan time becomes the binding latency constraint,
dropping to `sentence` alone is supported by this data at no measured recall
cost.

Caveats worth stating: this slice is 8140 passages, not the full 24.6k-passage
production index, so absolute recall here is higher than production; and MS
MARCO `is_selected` is a
sparse label (often exactly one passage per query, and other retrieved passages
may well answer the question), so these numbers understate real usefulness.
They are still comparable *between rows*, which is what the table is for.
