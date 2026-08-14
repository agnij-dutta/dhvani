# Dhvani latency benchmark

- run: 2026-08-14T13:53:17.137Z
- queries: 50 (data/eval_queries.jsonl (300 unique))
- generation: on (groq)
- k: 8
- index dir: `data/index`
- refusals: 14/50
- providers used: groq=50
- stage errors: none

All numbers in milliseconds, nearest-rank percentiles.

| stage | n | P50 | P70 | P90 | P100 | mean |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| guard | 50 | 0.0 | 0.0 | 0.1 | 2.1 | 0.1 |
| embed | 50 | 5.7 | 7.3 | 13.5 | 28.4 | 7.3 |
| retrieve | 50 | 31.9 | 33.3 | 40.9 | 53.7 | 31.3 |
| ttft (generation) | 50 | 389.6 | 2151.9 | 3158.8 | 7388.3 | 1280.3 |
| generate (full) | 50 | 542.1 | 2188.3 | 3158.9 | 7388.7 | 1336.7 |
| **ragMs (guard+embed+retrieve+ttft)** | 50 | 417.0 | 2187.3 | 3189.6 | 7412.9 | 1319.1 |
| **end-to-end** | 50 | 569.9 | 2225.6 | 3189.7 | 7413.5 | 1375.7 |

`ragMs` is the contract number: guard + embed + retrieve + TTFT. STT and full
generation are reported separately because they are dominated by third-party
network latency we don't control.
