# Dhvani latency benchmark

- run: 2026-08-15T11:37:55.842Z
- queries: 40 (data/eval_queries.jsonl (300 unique))
- generation: off (retrieval path only)
- k: 8
- index dir: `data/index-slim`
- refusals: 0/40
- providers used: none=40
- stage errors: none

All numbers in milliseconds, nearest-rank percentiles.

| stage | n | P50 | P70 | P90 | P100 | mean |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| guard | 40 | 0.0 | 0.0 | 0.0 | 2.2 | 0.1 |
| embed | 40 | 2.3 | 2.6 | 3.6 | 4.3 | 2.6 |
| retrieve | 40 | 8.5 | 9.1 | 10.0 | 20.8 | 9.2 |
| **ragMs (guard+embed+retrieve+ttft)** | 40 | 11.3 | 11.8 | 12.9 | 24.4 | 11.9 |
| **end-to-end** | 40 | 11.3 | 11.8 | 12.9 | 24.4 | 11.9 |

`ragMs` is the contract number: guard + embed + retrieve + TTFT. STT and full
generation are reported separately because they are dominated by third-party
network latency we don't control.
