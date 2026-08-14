# Dhvani latency benchmark

- run: 2026-08-14T13:12:57.553Z
- queries: 150 (data/eval_queries.jsonl (300 unique))
- generation: off (retrieval path only)
- k: 8
- index dir: `data/index`
- refusals: 0/150
- providers used: none=150
- stage errors: none

All numbers in milliseconds, nearest-rank percentiles.

| stage | n | P50 | P70 | P90 | P100 | mean |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| guard | 150 | 0.0 | 0.0 | 0.0 | 2.1 | 0.0 |
| embed | 150 | 1.7 | 1.9 | 2.2 | 3.8 | 1.8 |
| retrieve | 150 | 20.0 | 20.1 | 20.1 | 27.4 | 20.1 |
| **ragMs (guard+embed+retrieve+ttft)** | 150 | 21.8 | 21.9 | 22.3 | 30.8 | 21.9 |
| **end-to-end** | 150 | 21.8 | 21.9 | 22.3 | 30.8 | 21.9 |

`ragMs` is the contract number: guard + embed + retrieve + TTFT. STT and full
generation are reported separately because they are dominated by third-party
network latency we don't control.
