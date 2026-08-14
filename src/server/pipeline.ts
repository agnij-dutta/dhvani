// The harness: stt -> guard -> embed -> retrieve -> guard -> generate -> grounding.
//
// Every stage is individually try/caught and reports through `emit`, so a
// failure anywhere degrades into an {type:"error"} event followed by a proper
// {type:"done"} — the SSE stream always terminates cleanly and the caller
// always gets timings. Nothing here throws to its caller.
//
// Latency accounting (CONTRACTS.md is the source of truth):
//   ragMs = guardMs + embedMs + retrieveMs + ttftMs      <- the <200ms number
//   sttMs and generateMs are reported separately and honestly.
// Skipped stages are recorded as -1 so analytics can exclude rather than
// average them into a flattering zero.

import type {
  AnalyticsRecord,
  AskEvent,
  PipelineStage,
  PipelineTimings,
  RetrievedChunk,
} from "@/lib/types";
import { embedQuery } from "@/lib/embedder";
import { getIndex, type VectorIndex } from "@/lib/vindex";
import { speechToTextTranslate } from "./sarvam";
import { generateAnswer, NOT_IN_CONTEXT, type Provider } from "./generate";
import {
  checkGrounding,
  guardInput,
  guardRetrieval,
  OFF_TOPIC_MESSAGE,
  UNGROUNDED_MESSAGE,
} from "./guardrails";
import { appendRecord } from "./analytics";
import { ensureKeepWarm } from "./keepwarm";

export const DEFAULT_K = 8;

export interface PipelineAudio {
  buf: Buffer;
  mime: string;
}

export interface PipelineInput {
  audio?: PipelineAudio;
  /** used directly when there's no audio, and as a fallback if STT fails */
  text?: string;
}

export interface PipelineOptions {
  k?: number;
  /** false => stop after retrieval (bench --no-gen, or no provider keys) */
  generate?: boolean;
  signal?: AbortSignal;
  /** false => don't touch data/analytics.jsonl (used by warmup runs) */
  record?: boolean;
}

export interface PipelineResult {
  answer: string;
  provider: string;
  refused: boolean;
  transcript: string;
  languageCode: string;
  chunks: RetrievedChunk[];
  timings: PipelineTimings;
  errors: string[];
}

const SKIPPED = -1;

function emptyTimings(): PipelineTimings {
  return {
    sttMs: SKIPPED,
    guardMs: SKIPPED,
    embedMs: SKIPPED,
    retrieveMs: SKIPPED,
    ttftMs: SKIPPED,
    generateMs: SKIPPED,
    ragMs: SKIPPED,
    totalMs: SKIPPED,
  };
}

const ms = (from: number) => Math.round((performance.now() - from) * 100) / 100;
const pos = (n: number) => (n > 0 ? n : 0);

/**
 * getIndex() memoizes its promise on globalThis — including a rejected one, so
 * a load that fails before the ingest agent has written data/index would be
 * cached as a permanent failure. Drop the poisoned entry so the next request
 * retries.
 */
async function loadIndex(): Promise<VectorIndex> {
  try {
    return await getIndex();
  } catch (e) {
    delete (globalThis as { __dhvaniIndex?: unknown }).__dhvaniIndex;
    const dir = process.env.INDEX_DIR ?? "data/index";
    throw new Error(
      `vector index unavailable at "${dir}" — run the ingest script to build it (${(e as Error).message})`,
    );
  }
}

/**
 * Run one question end-to-end, streaming AskEvents through `emit`.
 * Resolves with the final state; never rejects.
 */
export async function runPipeline(
  input: { audio?: PipelineAudio; text?: string },
  emit: (e: AskEvent) => void,
  opts: PipelineOptions = {},
): Promise<PipelineResult> {
  const k = opts.k ?? DEFAULT_K;
  ensureKeepWarm();
  const timings = emptyTimings();
  const errors: string[] = [];
  const t0 = performance.now();

  let question = (input.text ?? "").trim();
  let languageCode = input.audio ? "unknown" : "en-IN";
  let chunks: RetrievedChunk[] = [];
  let answer = "";
  let provider: Provider | string = "none";
  let refused = false;

  const safeEmit = (e: AskEvent) => {
    try {
      emit(e);
    } catch {
      // a dead client must not abort the pipeline mid-stage
    }
  };

  const stage = (s: PipelineStage) => {
    const start = performance.now();
    safeEmit({ type: "stage", stage: s, status: "start" });
    return (recorded?: number) => {
      const took = recorded ?? ms(start);
      safeEmit({ type: "stage", stage: s, status: "done", ms: took });
      return took;
    };
  };

  const fail = (stageName: PipelineStage, e: unknown) => {
    const message = `${stageName}: ${(e as Error)?.message ?? String(e)}`;
    errors.push(message);
    safeEmit({ type: "error", message });
  };

  const finish = async (): Promise<PipelineResult> => {
    timings.ragMs =
      pos(timings.guardMs) + pos(timings.embedMs) + pos(timings.retrieveMs) + pos(timings.ttftMs);
    timings.totalMs = ms(t0);
    safeEmit({ type: "done", timings, answer, provider });

    if (opts.record !== false) {
      const record: AnalyticsRecord = {
        ts: Date.now(),
        query: question,
        languageCode,
        provider,
        refused,
        timings,
      };
      await appendRecord(record);
    }
    return { answer, provider, refused, transcript: question, languageCode, chunks, timings, errors };
  };

  // --- 1. STT ---------------------------------------------------------------
  if (input.audio) {
    const done = stage("stt");
    try {
      const stt = await speechToTextTranslate(input.audio.buf, input.audio.mime, {
        signal: opts.signal,
      });
      question = stt.transcript;
      languageCode = stt.languageCode;
      timings.sttMs = done();
    } catch (e) {
      timings.sttMs = done();
      fail("stt", e);
      // Not fatal: if the client also sent text we use that, otherwise we
      // refuse politely rather than crashing the stream.
      if (!question) {
        answer = "I couldn't transcribe that audio. Try again, or type your question instead.";
        refused = true;
        safeEmit({ type: "transcript", text: "", languageCode });
        return finish();
      }
    }
  }

  safeEmit({ type: "transcript", text: question, languageCode });

  // --- 2. Input guardrail ---------------------------------------------------
  {
    const done = stage("guard");
    const verdict = guardInput(question);
    timings.guardMs = done();
    if (!verdict.ok) {
      safeEmit({ type: "guardrail", verdict });
      answer = verdict.message;
      refused = true;
      return finish();
    }
  }

  // --- 3. Embed -------------------------------------------------------------
  let qvec: Float32Array;
  {
    const done = stage("embed");
    try {
      qvec = await embedQuery(question);
      timings.embedMs = done();
    } catch (e) {
      timings.embedMs = done();
      fail("embed", e);
      answer = "I couldn't process that question right now.";
      refused = true;
      return finish();
    }
  }

  // --- 4. Retrieve ----------------------------------------------------------
  {
    const done = stage("retrieve");
    try {
      const index = await loadIndex();
      // scan only the configured strategy partitions — on MS MARCO the eval
      // showed no recall gain from adding `parent` to `sentence`, and the
      // smaller scan keeps retrieveMs well inside the latency budget
      const strategies = (process.env.RETRIEVE_STRATEGIES ?? "sentence")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      chunks = index.search(qvec, k, strategies);
      timings.retrieveMs = done();
    } catch (e) {
      timings.retrieveMs = done();
      fail("retrieve", e);
      answer = "My knowledge base isn't loaded right now, so I can't answer that yet.";
      refused = true;
      return finish();
    }
  }

  // Chunks go out before the off-topic verdict so the UI can show *why* a
  // question was judged out-of-scope (weak top score) rather than just refusing.
  safeEmit({ type: "chunks", chunks });

  const retrievalVerdict = guardRetrieval(chunks);
  if (!retrievalVerdict.ok) {
    safeEmit({ type: "guardrail", verdict: retrievalVerdict });
    answer = retrievalVerdict.message;
    refused = true;
    return finish();
  }

  if (opts.generate === false) {
    return finish();
  }

  // --- 5. Generate ----------------------------------------------------------
  {
    const done = stage("generate");
    try {
      // top-4 only: fewer prompt tokens means faster prompt processing (lower
      // TTFT) and a smaller rate-limit footprint; the UI still shows all k
      const result = await generateAnswer(
        question,
        chunks.slice(0, 4),
        (t) => safeEmit({ type: "token", text: t }),
        opts.signal,
      );
      answer = result.answer;
      provider = result.provider;
      timings.ttftMs = Math.round(result.ttftMs * 100) / 100;
      timings.generateMs = done(Math.round(result.generateMs * 100) / 100);
    } catch (e) {
      timings.generateMs = done();
      fail("generate", e);
      answer = "I couldn't generate an answer right now.";
      refused = true;
      return finish();
    }
  }

  // --- 6. Grounding ---------------------------------------------------------
  {
    const done = stage("grounding");
    const notInContext = answer.trim() === NOT_IN_CONTEXT || answer.includes(NOT_IN_CONTEXT);
    const grounding = notInContext ? { score: 0, grounded: false } : checkGrounding(answer, chunks);
    done();
    safeEmit({ type: "grounding", score: grounding.score, grounded: grounding.grounded });

    if (notInContext) {
      answer = OFF_TOPIC_MESSAGE;
      refused = true;
      safeEmit({
        type: "guardrail",
        verdict: { ok: false, reason: "off_topic", message: OFF_TOPIC_MESSAGE },
      });
    } else if (!grounding.grounded) {
      answer = UNGROUNDED_MESSAGE;
      refused = true;
      safeEmit({
        type: "guardrail",
        verdict: { ok: false, reason: "ungrounded", message: UNGROUNDED_MESSAGE },
      });
    }
  }

  return finish();
}
