# Dhvani latency benchmark

- run: 2026-08-14T14:15:43.397Z
- queries: 50 (data/eval_queries.jsonl (300 unique))
- generation: on (groq)
- k: 8
- index dir: `data/index`
- refusals: 9/50
- providers used: groq=50
- stage errors: none

All numbers in milliseconds, nearest-rank percentiles.

| stage | n | P50 | P70 | P90 | P100 | mean |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| guard | 50 | 0.0 | 0.1 | 0.2 | 4.0 | 0.2 |
| embed | 50 | 8.8 | 10.6 | 16.1 | 48.9 | 10.5 |
| retrieve | 50 | 18.9 | 20.3 | 21.9 | 25.7 | 17.9 |
| ttft (generation) | 50 | 218.1 | 247.9 | 284.9 | 413.5 | 216.6 |
| generate (full) | 50 | 256.6 | 293.2 | 342.1 | 466.0 | 257.0 |
| **ragMs (guard+embed+retrieve+ttft)** | 50 | 253.4 | 282.7 | 308.9 | 436.3 | 245.2 |
| **end-to-end** | 50 | 289.1 | 322.5 | 374.0 | 487.3 | 286.1 |

`ragMs` is the contract number: guard + embed + retrieve + TTFT. STT and full
generation are reported separately because they are dominated by third-party
network latency we don't control.
