// Sarvam AI speech client.
//
// Two endpoints, one shape:
//   /speech-to-text-translate  (saaras:v3) — any of 22 Indic langs -> English text
//   /speech-to-text            (saarika:v2) — verbatim transcription in-language
//
// We default to *translate* mode: the corpus is English (MSMARCO-XI English
// passages) and the embedder is multilingual-e5, so translating at the edge
// gives us a single English retrieval path instead of cross-lingual drift.
//
// Everything external is zod-validated but leniently: Sarvam has shipped
// `transcript`, `text` and `translated_text` across doc revisions, so we accept
// any of them and normalize to `transcript`.

import { z } from "zod";

const TRANSLATE_URL = "https://api.sarvam.ai/speech-to-text-translate";
const STT_URL = "https://api.sarvam.ai/speech-to-text";

const DEFAULT_TRANSLATE_MODEL = "saaras:v3";
const DEFAULT_STT_MODEL = "saarika:v2.5";

const TIMEOUT_MS = 10_000;
const MAX_RETRIES = 2;

/** Lenient response schema — every field optional except "some kind of text". */
const SarvamResponseSchema = z
  .object({
    request_id: z.string().nullish(),
    transcript: z.string().nullish(),
    // doc-shape drift tolerance
    text: z.string().nullish(),
    translated_text: z.string().nullish(),
    language_code: z.string().nullish(),
    detected_language_code: z.string().nullish(),
  })
  .passthrough();

export interface SarvamTranscript {
  requestId: string;
  transcript: string;
  languageCode: string;
}

export interface SarvamOptions {
  /** false => plain speech-to-text (saarika), true => translate to English. Default true. */
  translate?: boolean;
  /** override the model id sent as a form field */
  model?: string;
  /** hint for plain STT mode; ignored by the translate endpoint */
  languageCode?: string;
  signal?: AbortSignal;
}

export class SarvamError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "SarvamError";
  }
}

function apiKey(): string {
  const key = process.env.SARVAM_API_KEY;
  if (!key) {
    throw new SarvamError(
      "SARVAM_API_KEY is not set — speech input is unavailable. Set it in .env.local or use the text input path.",
    );
  }
  return key;
}

/** webm/ogg/wav/mp3 -> a filename Sarvam's multipart parser is happy with. */
function filenameFor(mime: string): string {
  const base = mime.split(";")[0].trim().toLowerCase();
  const ext =
    base === "audio/webm" || base === "video/webm"
      ? "webm"
      : base === "audio/ogg" || base === "application/ogg"
        ? "ogg"
        : base === "audio/wav" || base === "audio/x-wav" || base === "audio/wave"
          ? "wav"
          : base === "audio/mpeg" || base === "audio/mp3"
            ? "mp3"
            : base === "audio/mp4" || base === "audio/m4a" || base === "audio/x-m4a"
              ? "m4a"
              : "webm";
  return `audio.${ext}`;
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** Retry only on transport failures, 429 and 5xx. 4xx is our bug, not theirs. */
function isRetryable(status: number | undefined): boolean {
  if (status === undefined) return true; // network / timeout
  return status === 429 || status >= 500;
}

/**
 * Transcribe (and by default translate to English) an audio buffer.
 * Timeout 10s per attempt, 2 retries with exponential backoff on 5xx/429.
 */
export async function transcribe(
  audio: Buffer,
  mime: string,
  opts: SarvamOptions = {},
): Promise<SarvamTranscript> {
  const translate = opts.translate ?? true;
  const url = translate ? TRANSLATE_URL : STT_URL;
  const model = opts.model ?? (translate ? DEFAULT_TRANSLATE_MODEL : DEFAULT_STT_MODEL);
  const key = apiKey();

  let lastErr: SarvamError = new SarvamError("sarvam: no attempt made");

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    // A fresh FormData/Blob per attempt — bodies are single-use streams.
    const form = new FormData();
    const bytes = new Uint8Array(audio);
    form.append("file", new Blob([bytes], { type: mime || "audio/webm" }), filenameFor(mime));
    form.append("model", model);
    if (!translate && opts.languageCode) form.append("language_code", opts.languageCode);

    const timer = new AbortController();
    const to = setTimeout(() => timer.abort(), TIMEOUT_MS);
    const onOuterAbort = () => timer.abort();
    opts.signal?.addEventListener("abort", onOuterAbort, { once: true });

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "api-subscription-key": key },
        body: form,
        signal: timer.signal,
      });

      if (!res.ok) {
        const body = await res.text().catch(() => "");
        const err = new SarvamError(
          `sarvam ${res.status}: ${body.slice(0, 300) || res.statusText}`,
          res.status,
        );
        if (isRetryable(res.status) && attempt < MAX_RETRIES) {
          lastErr = err;
          await sleep(250 * 2 ** attempt);
          continue;
        }
        throw err;
      }

      const json: unknown = await res.json();
      const parsed = SarvamResponseSchema.safeParse(json);
      if (!parsed.success) {
        throw new SarvamError(`sarvam: unexpected response shape: ${parsed.error.message}`);
      }
      const d = parsed.data;
      const transcript = d.transcript ?? d.translated_text ?? d.text ?? "";
      if (!transcript.trim()) {
        throw new SarvamError("sarvam returned an empty transcript — no speech detected");
      }
      return {
        requestId: d.request_id ?? "",
        transcript: transcript.trim(),
        languageCode: d.language_code ?? d.detected_language_code ?? "unknown",
      };
    } catch (e) {
      const err =
        e instanceof SarvamError
          ? e
          : new SarvamError(
              (e as Error)?.name === "AbortError"
                ? `sarvam: request timed out after ${TIMEOUT_MS}ms`
                : `sarvam: ${(e as Error)?.message ?? String(e)}`,
            );
      // Non-retryable (4xx, shape errors, missing key) bail immediately.
      if (e instanceof SarvamError && !isRetryable(e.status)) throw err;
      if (attempt >= MAX_RETRIES) throw err;
      lastErr = err;
      await sleep(250 * 2 ** attempt);
    } finally {
      clearTimeout(to);
      opts.signal?.removeEventListener("abort", onOuterAbort);
    }
  }

  throw lastErr;
}

/** Explicit translate-mode helper (the pipeline default). */
export function speechToTextTranslate(
  audio: Buffer,
  mime: string,
  opts: Omit<SarvamOptions, "translate"> = {},
): Promise<SarvamTranscript> {
  return transcribe(audio, mime, { ...opts, translate: true });
}

/** Plain in-language transcription, no translation. */
export function speechToText(
  audio: Buffer,
  mime: string,
  opts: Omit<SarvamOptions, "translate"> = {},
): Promise<SarvamTranscript> {
  return transcribe(audio, mime, { ...opts, translate: false });
}

export function sarvamConfigured(): boolean {
  return Boolean(process.env.SARVAM_API_KEY);
}
