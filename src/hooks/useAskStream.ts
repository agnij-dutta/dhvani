"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import type {
  AskEvent,
  GuardrailVerdict,
  PipelineStage,
  PipelineTimings,
  RetrievedChunk,
} from "@/lib/types";

export const PIPELINE_STAGES: PipelineStage[] = [
  "stt",
  "guard",
  "embed",
  "retrieve",
  "generate",
  "grounding",
];

export type StageStatus = "waiting" | "active" | "done";

export interface StageState {
  status: StageStatus;
  ms?: number;
}

export type Refusal = Extract<GuardrailVerdict, { ok: false }>;

export interface AskState {
  phase: "idle" | "streaming" | "done" | "error";
  stages: Record<PipelineStage, StageState>;
  transcript: { text: string; languageCode: string } | null;
  chunks: RetrievedChunk[];
  answer: string;
  refusal: Refusal | null;
  grounding: { score: number; grounded: boolean } | null;
  timings: PipelineTimings | null;
  provider: string | null;
  error: string | null;
}

function blankStages(): Record<PipelineStage, StageState> {
  return PIPELINE_STAGES.reduce(
    (acc, stage) => {
      acc[stage] = { status: "waiting" };
      return acc;
    },
    {} as Record<PipelineStage, StageState>,
  );
}

const INITIAL: AskState = {
  phase: "idle",
  stages: blankStages(),
  transcript: null,
  chunks: [],
  answer: "",
  refusal: null,
  grounding: null,
  timings: null,
  provider: null,
  error: null,
};

function isAskEvent(value: unknown): value is AskEvent {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { type?: unknown }).type === "string"
  );
}

/** Reduce one SSE event into UI state. Unknown event types are ignored. */
function reduce(state: AskState, event: AskEvent): AskState {
  switch (event.type) {
    case "stage": {
      if (!PIPELINE_STAGES.includes(event.stage)) return state;
      const prev = state.stages[event.stage];
      return {
        ...state,
        stages: {
          ...state.stages,
          [event.stage]:
            event.status === "start"
              ? { status: "active", ms: prev?.ms }
              : { status: "done", ms: event.ms ?? prev?.ms },
        },
      };
    }
    case "transcript":
      return {
        ...state,
        transcript: {
          text: typeof event.text === "string" ? event.text : "",
          languageCode:
            typeof event.languageCode === "string" ? event.languageCode : "",
        },
      };
    case "chunks":
      return {
        ...state,
        chunks: Array.isArray(event.chunks) ? event.chunks : [],
      };
    case "token":
      return {
        ...state,
        answer: state.answer + (typeof event.text === "string" ? event.text : ""),
      };
    case "guardrail":
      return event.verdict?.ok === false
        ? { ...state, refusal: event.verdict }
        : state;
    case "grounding":
      return {
        ...state,
        grounding: { score: event.score, grounded: event.grounded },
      };
    case "done":
      return {
        ...state,
        phase: "done",
        timings: event.timings ?? null,
        provider: event.provider ?? null,
        answer: state.answer || event.answer || "",
        stages: PIPELINE_STAGES.reduce(
          (acc, stage) => {
            const current = state.stages[stage];
            acc[stage] =
              current.status === "active"
                ? { status: "done", ms: current.ms }
                : current;
            return acc;
          },
          {} as Record<PipelineStage, StageState>,
        ),
      };
    case "error":
      return {
        ...state,
        phase: "error",
        error: event.message || "The pipeline failed mid-stream.",
      };
    default:
      return state;
  }
}

export type AskInput = { text: string } | { blob: Blob; filename: string };

export function useAskStream() {
  const [state, setState] = useState<AskState>(INITIAL);
  const abortRef = useRef<AbortController | null>(null);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setState({ ...INITIAL, stages: blankStages() });
  }, []);

  const ask = useCallback(async (input: AskInput) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setState({ ...INITIAL, stages: blankStages(), phase: "streaming" });

    let body: BodyInit;
    let headers: HeadersInit | undefined;
    if ("text" in input) {
      body = JSON.stringify({ text: input.text });
      headers = { "content-type": "application/json" };
    } else {
      const form = new FormData();
      form.append("audio", input.blob, input.filename);
      body = form;
    }

    try {
      const res = await fetch("/api/ask", {
        method: "POST",
        body,
        headers,
        signal: controller.signal,
      });

      if (!res.ok || !res.body) {
        setState((s) => ({
          ...s,
          phase: "error",
          error: `The server returned ${res.status}. Try again.`,
        }));
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      // SSE frames are separated by a blank line; a frame may span reads.
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let boundary = buffer.indexOf("\n\n");
        while (boundary !== -1) {
          const frame = buffer.slice(0, boundary);
          buffer = buffer.slice(boundary + 2);
          boundary = buffer.indexOf("\n\n");

          const payload = frame
            .split("\n")
            .filter((line) => line.startsWith("data:"))
            .map((line) => line.slice(5).trimStart())
            .join("\n");
          if (!payload) continue;

          let parsed: unknown;
          try {
            parsed = JSON.parse(payload);
          } catch {
            continue;
          }
          if (!isAskEvent(parsed)) continue;
          const event = parsed;
          setState((s) => reduce(s, event));
        }
      }

      setState((s) => (s.phase === "streaming" ? { ...s, phase: "done" } : s));
    } catch (err) {
      if (controller.signal.aborted) return;
      setState((s) => ({
        ...s,
        phase: "error",
        error:
          err instanceof Error ? err.message : "The connection dropped mid-answer.",
      }));
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
    }
  }, []);

  const busy = state.phase === "streaming";

  return useMemo(
    () => ({ state, ask, reset, busy }),
    [state, ask, reset, busy],
  );
}
