// POST /api/ask — multipart (`audio` file) or JSON {text}. Streams AskEvents
// as SSE. Every event is enqueued the moment the pipeline emits it, so the
// client sees stage/token events in real time rather than in one flush at the
// end.

import { z } from "zod";
import { runPipeline } from "@/server/pipeline";
import { configuredProviders } from "@/server/generate";
import { warmup } from "@/lib/embedder";
import { getIndex } from "@/lib/vindex";
import type { AskEvent } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TextBody = z.object({ text: z.string().min(1) });

const MAX_AUDIO_BYTES = 25 * 1024 * 1024;

// Kick the model + index load once per process; the request path awaits nothing.
let warmed: Promise<void> | null = null;
function lazyWarm(): void {
  if (warmed) return;
  warmed = Promise.allSettled([warmup(), getIndex()]).then(() => {});
}

const encoder = new TextEncoder();

function sse(event: AskEvent): Uint8Array {
  return encoder.encode(`data: ${JSON.stringify(event)}\n\n`);
}

export async function POST(req: Request): Promise<Response> {
  lazyWarm();

  let audio: { buf: Buffer; mime: string } | undefined;
  let text: string | undefined;

  try {
    const contentType = req.headers.get("content-type") ?? "";
    if (contentType.includes("multipart/form-data")) {
      const form = await req.formData();
      const file = form.get("audio");
      const formText = form.get("text");
      if (typeof formText === "string" && formText.trim()) text = formText.trim();
      if (file && typeof file !== "string") {
        if (file.size > MAX_AUDIO_BYTES) {
          return Response.json({ error: "audio too large (max 25MB)" }, { status: 413 });
        }
        audio = {
          buf: Buffer.from(await file.arrayBuffer()),
          mime: file.type || "audio/webm",
        };
      }
      if (!audio && !text) {
        return Response.json({ error: "multipart body needs an `audio` file or `text`" }, { status: 400 });
      }
    } else {
      const parsed = TextBody.safeParse(await req.json());
      if (!parsed.success) {
        return Response.json({ error: "body must be { text: string }" }, { status: 400 });
      }
      text = parsed.data.text;
    }
  } catch (e) {
    return Response.json({ error: `malformed request: ${(e as Error).message}` }, { status: 400 });
  }

  const generate = configuredProviders().length > 0;
  const abort = new AbortController();
  req.signal?.addEventListener("abort", () => abort.abort(), { once: true });

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let closed = false;
      const emit = (e: AskEvent) => {
        if (closed) return;
        try {
          controller.enqueue(sse(e));
        } catch {
          closed = true;
        }
      };
      try {
        await runPipeline({ audio, text }, emit, { generate, signal: abort.signal });
      } catch (e) {
        // runPipeline is meant never to throw; belt and braces.
        emit({ type: "error", message: (e as Error)?.message ?? String(e) });
      } finally {
        closed = true;
        try {
          controller.close();
        } catch {
          /* already closed by the client disconnecting */
        }
      }
    },
    cancel() {
      abort.abort();
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
      // disable proxy buffering so tokens actually stream
      "x-accel-buffering": "no",
    },
  });
}
