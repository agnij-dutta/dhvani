// Answer generation with a provider fallback chain.
//
//   1. Groq  llama-3.1-8b-instant   (primary — sub-100ms TTFT on a good day)
//   2. Gemini gemini-2.5-flash-lite (fallback — used when Groq errors or
//                                    GROQ_API_KEY is missing)
//
// Both are streamed; TTFT is measured from the moment generateAnswer() is
// called (not from the moment the HTTP request opens), because the caller's
// latency budget starts when it hands us the question.

import type { RetrievedChunk } from "@/lib/types";

export const GROQ_MODEL = "llama-3.1-8b-instant";
export const GEMINI_MODEL = "gemini-2.5-flash-lite";

const MAX_TOKENS = 200;
const TEMPERATURE = 0.2;

/** The exact string the model must emit when the context can't answer. */
export const NOT_IN_CONTEXT = "NOT_IN_CONTEXT";

export const SYSTEM_PROMPT = [
  "You are a precise retrieval-grounded assistant.",
  "Answer ONLY from the numbered context passages given by the user.",
  "Cite the passages you used inline with bracketed numbers like [1] or [2][3].",
  "Keep the answer to 2-4 sentences.",
  "Do not use outside knowledge, do not speculate, do not add caveats.",
  `If the context does not contain the answer, reply with exactly ${NOT_IN_CONTEXT} and nothing else.`,
].join(" ");

export type Provider = "groq" | "gemini" | "none";

export interface GenerateResult {
  answer: string;
  provider: Provider;
  /** ms from generateAnswer() entry to the first streamed token */
  ttftMs: number;
  /** ms from generateAnswer() entry to stream completion */
  generateMs: number;
}

export type TokenSink = (token: string) => void;

export class GenerationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GenerationError";
  }
}

/** Numbered context block the system prompt refers to. */
export function buildContext(chunks: RetrievedChunk[]): string {
  return chunks
    .map((c, i) => `[${i + 1}] ${(c.parentText ?? c.text).replace(/\s+/g, " ").trim()}`)
    .join("\n\n");
}

function buildUserPrompt(question: string, chunks: RetrievedChunk[]): string {
  return `Context passages:\n\n${buildContext(chunks)}\n\nQuestion: ${question}\n\nAnswer:`;
}

export function groqConfigured(): boolean {
  return Boolean(process.env.GROQ_API_KEY);
}

export function geminiConfigured(): boolean {
  return Boolean(process.env.GEMINI_API_KEY);
}

/** Providers available right now, in fallback order. */
export function configuredProviders(): Provider[] {
  const out: Provider[] = [];
  if (groqConfigured()) out.push("groq");
  if (geminiConfigured()) out.push("gemini");
  return out;
}

// --- Groq ------------------------------------------------------------------

async function generateGroq(
  question: string,
  chunks: RetrievedChunk[],
  onToken: TokenSink,
  t0: number,
  signal?: AbortSignal,
): Promise<{ answer: string; ttftMs: number }> {
  const key = process.env.GROQ_API_KEY;
  if (!key) throw new GenerationError("GROQ_API_KEY is not set");

  const { default: Groq } = await import("groq-sdk");
  const client = new Groq({ apiKey: key });

  const stream = await client.chat.completions.create(
    {
      model: GROQ_MODEL,
      stream: true,
      temperature: TEMPERATURE,
      max_tokens: MAX_TOKENS,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: buildUserPrompt(question, chunks) },
      ],
    },
    { signal },
  );

  let answer = "";
  let ttftMs = -1;
  for await (const chunk of stream) {
    const delta = chunk.choices?.[0]?.delta?.content ?? "";
    if (!delta) continue;
    if (ttftMs < 0) ttftMs = performance.now() - t0;
    answer += delta;
    onToken(delta);
  }
  if (ttftMs < 0) ttftMs = performance.now() - t0;
  return { answer: answer.trim(), ttftMs };
}

// --- Gemini ----------------------------------------------------------------

async function generateGemini(
  question: string,
  chunks: RetrievedChunk[],
  onToken: TokenSink,
  t0: number,
  signal?: AbortSignal,
): Promise<{ answer: string; ttftMs: number }> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new GenerationError("GEMINI_API_KEY is not set");

  const { GoogleGenAI } = await import("@google/genai");
  const ai = new GoogleGenAI({ apiKey: key });

  const stream = await ai.models.generateContentStream({
    model: GEMINI_MODEL,
    contents: buildUserPrompt(question, chunks),
    config: {
      systemInstruction: SYSTEM_PROMPT,
      temperature: TEMPERATURE,
      maxOutputTokens: MAX_TOKENS,
      abortSignal: signal,
    },
  });

  let answer = "";
  let ttftMs = -1;
  for await (const chunk of stream) {
    const delta = chunk.text ?? "";
    if (!delta) continue;
    if (ttftMs < 0) ttftMs = performance.now() - t0;
    answer += delta;
    onToken(delta);
  }
  if (ttftMs < 0) ttftMs = performance.now() - t0;
  return { answer: answer.trim(), ttftMs };
}

// --- Public ----------------------------------------------------------------

/**
 * Stream an answer from the first working provider.
 * Throws GenerationError naming the missing env var when nothing is configured.
 */
export async function generateAnswer(
  question: string,
  chunks: RetrievedChunk[],
  onToken: TokenSink = () => {},
  signal?: AbortSignal,
): Promise<GenerateResult> {
  const t0 = performance.now();
  const errors: string[] = [];

  if (groqConfigured()) {
    try {
      const { answer, ttftMs } = await generateGroq(question, chunks, onToken, t0, signal);
      return { answer, provider: "groq", ttftMs, generateMs: performance.now() - t0 };
    } catch (e) {
      if (signal?.aborted) throw e;
      errors.push(`groq: ${(e as Error)?.message ?? String(e)}`);
    }
  } else {
    errors.push("groq: GROQ_API_KEY is not set");
  }

  if (geminiConfigured()) {
    try {
      const { answer, ttftMs } = await generateGemini(question, chunks, onToken, t0, signal);
      return { answer, provider: "gemini", ttftMs, generateMs: performance.now() - t0 };
    } catch (e) {
      if (signal?.aborted) throw e;
      errors.push(`gemini: ${(e as Error)?.message ?? String(e)}`);
    }
  } else {
    errors.push("gemini: GEMINI_API_KEY is not set");
  }

  throw new GenerationError(`all generation providers failed — ${errors.join("; ")}`);
}
