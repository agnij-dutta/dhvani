// Shared contracts for the Dhvani voice-RAG pipeline.
// Every stage of the harness speaks these types — do not fork them locally.

export type ChunkStrategy =
  | "fixed" // fixed-size token window with overlap (baseline)
  | "sentence" // sentence-boundary packing to a target size
  | "sliding" // sliding window, stride < window
  | "semantic" // split where adjacent-sentence embedding similarity drops
  | "parent"; // small child chunks that map back to a parent passage

export interface ChunkMeta {
  /** stable id: `${strategy}:${queryId}:${passageIdx}:${n}` */
  id: string;
  strategy: ChunkStrategy;
  /** MSMARCO-XI query_id the passage came from */
  queryId: number;
  passageIdx: number;
  /** 1 if MS MARCO marked this passage as answering its query */
  isSelected: number;
  queryType: string;
  /** language pair of the source row, e.g. "eng_Latn->asm_Beng" */
  langPair: string;
  /** id of the parent chunk (parent strategy only) */
  parentId?: string;
  text: string;
  /** parent passage text when strategy === "parent" */
  parentText?: string;
}

export interface RetrievedChunk extends ChunkMeta {
  score: number;
}

/** Per-stage wall-clock timings in ms. -1 = stage skipped. */
export interface PipelineTimings {
  sttMs: number;
  guardMs: number;
  embedMs: number;
  retrieveMs: number;
  /** time to first generated token, from generation start */
  ttftMs: number;
  generateMs: number;
  /** retrieval-path total: guard + embed + retrieve + ttft (the <200ms target) */
  ragMs: number;
  totalMs: number;
}

export type GuardrailVerdict =
  | { ok: true }
  | {
      ok: false;
      reason: "unsafe_input" | "off_topic" | "empty_query" | "ungrounded";
      message: string;
    };

/** SSE events streamed by POST /api/ask */
export type AskEvent =
  | { type: "stage"; stage: PipelineStage; status: "start" | "done"; ms?: number }
  | { type: "transcript"; text: string; languageCode: string }
  | { type: "chunks"; chunks: RetrievedChunk[] }
  | { type: "token"; text: string }
  | { type: "guardrail"; verdict: GuardrailVerdict }
  | { type: "grounding"; score: number; grounded: boolean }
  | { type: "done"; timings: PipelineTimings; answer: string; provider: string }
  | { type: "error"; message: string };

export type PipelineStage =
  | "stt"
  | "guard"
  | "embed"
  | "retrieve"
  | "generate"
  | "grounding";

export interface AnalyticsRecord {
  ts: number;
  query: string;
  languageCode: string;
  provider: string;
  refused: boolean;
  timings: PipelineTimings;
}

export interface LatencyStats {
  count: number;
  p50: number;
  p70: number;
  p90: number;
  p100: number;
  mean: number;
}
