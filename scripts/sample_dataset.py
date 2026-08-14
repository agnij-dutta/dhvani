#!/usr/bin/env python
"""Sample the MSMARCO-XI validation shard into a deduped English passage corpus.

Reads the parquet at --parquet (97,941 rows), takes a deterministic random
sample of rows, and explodes each row's 10 English passages into individual
corpus records.

MS MARCO reuses the same passage text across many queries (and MSMARCO-XI
repeats every English query once per target language), so the same passage can
appear dozens of times in a sample. We dedupe on a normalized text hash,
keeping the first occurrence as canonical, but OR-ing `is_selected` across all
occurrences so a passage that answers *any* of its queries stays marked.

Outputs (JSONL, one object per line):
  data/corpus.jsonl        {id, queryId, passageIdx, isSelected, queryType,
                            langPair, text, engQuery, engAnswer}
  data/eval_queries.jsonl  {queryId, query, answer, queryType,
                            selectedPassageIds: string[]}

Passage id format is `${queryId}:${passageIdx}`, which is what the TS chunkers
reconstruct from ChunkMeta for retrieval eval.

Run:
  /Users/agnijdutta/Desktop/_hhgoa_data/venv/bin/python scripts/sample_dataset.py -n 2500
"""

from __future__ import annotations

import argparse
import hashlib
import json
import random
import re
import sys
import time
from pathlib import Path

import pyarrow.parquet as pq

DEFAULT_PARQUET = "/Users/agnijdutta/Desktop/_hhgoa_data/val_0.parquet"
COLUMNS = [
    "source_lang",
    "target_lang",
    "Answer",
    "query_id",
    "query_type",
    "passages",
    "Eng_Query",
    "Eng_Answer",
]

_WS = re.compile(r"\s+")
_PUNCT = re.compile(r"[^\w\s]")


def norm_key(text: str) -> str:
    """Normalized hash key: casefold, strip punctuation, collapse whitespace."""
    t = _PUNCT.sub(" ", text.casefold())
    return hashlib.sha1(_WS.sub(" ", t).strip().encode("utf-8")).hexdigest()


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("-n", "--rows", type=int, default=2500, help="rows to sample")
    ap.add_argument("--parquet", default=DEFAULT_PARQUET)
    ap.add_argument("--out-dir", default="data")
    ap.add_argument("--seed", type=int, default=42)
    ap.add_argument("--max-queries", type=int, default=300, help="cap on eval queries")
    ap.add_argument("--min-words", type=int, default=15, help="drop shorter passages")
    args = ap.parse_args()

    t0 = time.time()
    pf = pq.ParquetFile(args.parquet)
    total_rows = pf.metadata.num_rows
    n = min(args.rows, total_rows)
    rng = random.Random(args.seed)
    wanted = set(rng.sample(range(total_rows), n))
    print(f"[sample] {args.parquet}: {total_rows} rows -> sampling {n} (seed {args.seed})")

    # canonical passage store, insertion-ordered
    passages: dict[str, dict] = {}  # hash -> record
    hash_to_pid: dict[str, str] = {}  # hash -> "queryId:passageIdx"
    taken_pids: set[str] = set()
    eval_rows: list[dict] = []
    seen_query_ids: set[int] = set()
    stats = {"rows": 0, "raw_passages": 0, "dupes": 0, "short": 0, "pid_collisions": 0}

    cursor = 0
    for batch in pf.iter_batches(batch_size=2048, columns=COLUMNS):
        lo, hi = cursor, cursor + batch.num_rows
        cursor = hi
        if not any(i in wanted for i in range(lo, hi)):
            continue
        rows = batch.to_pylist()
        for off, row in enumerate(rows):
            if lo + off not in wanted:
                continue
            stats["rows"] += 1
            qid = int(row["query_id"])
            lang_pair = f"{row['source_lang']}->{row['target_lang']}"
            qtype = row["query_type"] or ""
            eng_query = (row["Eng_Query"] or "").strip()
            eng_answer = (row["Eng_Answer"] or "").strip()
            p = row["passages"] or {}
            texts = p.get("English_passages") or []
            selected = p.get("is_selected") or []

            selected_pids: list[str] = []
            for idx, text in enumerate(texts):
                text = (text or "").strip()
                if not text:
                    continue
                stats["raw_passages"] += 1
                is_sel = int(selected[idx]) if idx < len(selected) else 0
                h = norm_key(text)
                if h in passages:
                    stats["dupes"] += 1
                    if is_sel:
                        passages[h]["isSelected"] = 1
                        selected_pids.append(hash_to_pid[h])
                    continue
                if len(text.split()) < args.min_words:
                    stats["short"] += 1
                    continue
                pid = f"{qid}:{idx}"
                if pid in taken_pids:
                    # same query_id seen in another language row with a different
                    # passage ordering — the id would not be unique, so drop it.
                    stats["pid_collisions"] += 1
                    continue
                taken_pids.add(pid)
                hash_to_pid[h] = pid
                passages[h] = {
                    "id": pid,
                    "queryId": qid,
                    "passageIdx": idx,
                    "isSelected": is_sel,
                    "queryType": qtype,
                    "langPair": lang_pair,
                    "text": text,
                    "engQuery": eng_query,
                    "engAnswer": eng_answer,
                }
                if is_sel:
                    selected_pids.append(pid)

            # eval query: needs an English query, an answer, and at least one
            # selected passage that survived dedupe (resolved to canonical id)
            if (
                eng_query
                and eng_answer
                and eng_answer.lower() != "no answer present."
                and selected_pids
                and qid not in seen_query_ids
            ):
                seen_query_ids.add(qid)
                eval_rows.append(
                    {
                        "queryId": qid,
                        "query": eng_query,
                        "answer": eng_answer,
                        "queryType": qtype,
                        "selectedPassageIds": sorted(set(selected_pids)),
                    }
                )

    out_dir = Path(args.out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    corpus_path = out_dir / "corpus.jsonl"
    eval_path = out_dir / "eval_queries.jsonl"

    with corpus_path.open("w", encoding="utf-8") as f:
        for rec in passages.values():
            f.write(json.dumps(rec, ensure_ascii=False) + "\n")

    rng.shuffle(eval_rows)
    eval_rows = eval_rows[: args.max_queries]
    with eval_path.open("w", encoding="utf-8") as f:
        for rec in eval_rows:
            f.write(json.dumps(rec, ensure_ascii=False) + "\n")

    n_sel = sum(1 for r in passages.values() if r["isSelected"])
    words = [len(r["text"].split()) for r in passages.values()]
    words.sort()
    med = words[len(words) // 2] if words else 0
    print(
        f"[sample] rows={stats['rows']} raw_passages={stats['raw_passages']} "
        f"dupes={stats['dupes']} short_dropped={stats['short']} "
        f"pid_collisions={stats['pid_collisions']}"
    )
    print(
        f"[sample] corpus={len(passages)} passages ({n_sel} selected) "
        f"words: median={med} p90={words[int(len(words) * 0.9)] if words else 0} "
        f"max={words[-1] if words else 0}"
    )
    print(f"[sample] eval_queries={len(eval_rows)} (cap {args.max_queries})")
    print(f"[sample] wrote {corpus_path} + {eval_path} in {time.time() - t0:.1f}s")
    return 0


if __name__ == "__main__":
    sys.exit(main())
