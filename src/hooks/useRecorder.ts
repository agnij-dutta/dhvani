"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { blobToWav } from "@/lib/wav";

export type RecorderState =
  | "idle"
  | "requesting"
  | "recording"
  | "denied"
  | "unsupported"
  | "error";

export interface Utterance {
  blob: Blob;
  mimeType: string;
  durationMs: number;
}

export interface UseRecorder {
  state: RecorderState;
  error: string | null;
  /** live RMS level, 0..1 — read imperatively in a rAF loop, never re-renders */
  levelRef: React.RefObject<number>;
  start: () => Promise<void>;
  stop: () => Promise<Utterance | null>;
  cancel: () => void;
}

/**
 * MIME negotiation ladder. Sarvam accepts ogg/opus and webm/opus; ogg first
 * because it needs no server-side remux. Safari lands on mp4/aac.
 */
function pickMimeType(): string | null {
  if (typeof MediaRecorder === "undefined") return null;
  const ladder = [
    "audio/ogg;codecs=opus",
    "audio/ogg",
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4",
  ];
  for (const type of ladder) {
    if (MediaRecorder.isTypeSupported(type)) return type;
  }
  return null;
}

export function extensionFor(mimeType: string): string {
  if (mimeType.includes("ogg")) return "ogg";
  if (mimeType.includes("webm")) return "webm";
  if (mimeType.includes("mp4")) return "m4a";
  return "bin";
}

export function useRecorder(): UseRecorder {
  const [state, setState] = useState<RecorderState>("idle");
  const [error, setError] = useState<string | null>(null);

  const levelRef = useRef(0);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const mimeRef = useRef<string>("audio/webm");
  const startedAtRef = useRef(0);
  const meterRef = useRef<{ ctx: AudioContext; raf: number } | null>(null);

  const stopMeter = useCallback(() => {
    const meter = meterRef.current;
    if (!meter) return;
    cancelAnimationFrame(meter.raf);
    void meter.ctx.close().catch(() => {});
    meterRef.current = null;
    levelRef.current = 0;
  }, []);

  /** AnalyserNode RMS metering — fftSize 512, smoothing 0.8, time-domain RMS. */
  const startMeter = useCallback(
    (stream: MediaStream) => {
      stopMeter();
      try {
        const ctx = new AudioContext();
        const source = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 512;
        analyser.smoothingTimeConstant = 0.8;
        source.connect(analyser);

        const buffer = new Uint8Array(analyser.fftSize);
        let smoothed = 0;

        const tick = () => {
          analyser.getByteTimeDomainData(buffer);
          let sum = 0;
          for (let i = 0; i < buffer.length; i++) {
            const v = (buffer[i] - 128) / 128;
            sum += v * v;
          }
          const rms = Math.sqrt(sum / buffer.length);
          // speech RMS sits low; lift it into a usable 0..1 display range
          const scaled = Math.min(1, rms * 4.2);
          smoothed = smoothed * 0.72 + scaled * 0.28;
          levelRef.current = smoothed;
          if (meterRef.current) {
            meterRef.current.raf = requestAnimationFrame(tick);
          }
        };

        meterRef.current = { ctx, raf: requestAnimationFrame(tick) };
      } catch {
        // metering is decorative — recording continues without it
      }
    },
    [stopMeter],
  );

  const teardown = useCallback(() => {
    stopMeter();
    recorderRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, [stopMeter]);

  const start = useCallback(async () => {
    if (recorderRef.current) return;
    setError(null);

    if (
      typeof navigator === "undefined" ||
      !navigator.mediaDevices?.getUserMedia ||
      typeof MediaRecorder === "undefined"
    ) {
      setState("unsupported");
      setError("This browser can't record audio. Type your question instead.");
      return;
    }

    const mimeType = pickMimeType();
    if (!mimeType) {
      setState("unsupported");
      setError("No supported audio format. Type your question instead.");
      return;
    }

    setState("requesting");
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1,
          sampleRate: 16000,
        },
      });
    } catch (err) {
      const name = err instanceof DOMException ? err.name : "";
      if (name === "NotAllowedError" || name === "SecurityError") {
        setState("denied");
        setError(
          "Microphone access is blocked. Allow it in your browser's site settings, then reload.",
        );
      } else if (name === "NotFoundError" || name === "OverconstrainedError") {
        setState("error");
        setError("No microphone found. Connect one or type your question.");
      } else {
        setState("error");
        setError(
          err instanceof Error ? err.message : "Couldn't open the microphone.",
        );
      }
      return;
    }

    streamRef.current = stream;
    mimeRef.current = mimeType;
    chunksRef.current = [];

    const recorder = new MediaRecorder(stream, {
      mimeType,
      audioBitsPerSecond: 64000,
    });
    recorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) chunksRef.current.push(event.data);
    };
    recorder.onerror = () => {
      setState("error");
      setError("Recording stopped unexpectedly.");
      teardown();
    };

    recorderRef.current = recorder;
    startedAtRef.current = performance.now();
    recorder.start();
    startMeter(stream);
    setState("recording");
  }, [startMeter, teardown]);

  const stop = useCallback(async (): Promise<Utterance | null> => {
    const recorder = recorderRef.current;
    if (!recorder) return null;

    const durationMs = performance.now() - startedAtRef.current;
    const blob = await new Promise<Blob>((resolve) => {
      recorder.onstop = () => {
        resolve(new Blob(chunksRef.current, { type: mimeRef.current }));
      };
      if (recorder.state !== "inactive") recorder.stop();
      else resolve(new Blob(chunksRef.current, { type: mimeRef.current }));
    });

    teardown();
    setState("idle");
    chunksRef.current = [];

    if (blob.size < 512 || durationMs < 350) return null;
    // Sarvam rejects webm/ogg containers — convert to 16kHz mono WAV in-browser
    try {
      const wav = await blobToWav(blob);
      return { blob: wav, mimeType: "audio/wav", durationMs };
    } catch {
      // decode failed (rare) — send the original and let the server report
      return { blob, mimeType: mimeRef.current, durationMs };
    }
  }, [teardown]);

  const cancel = useCallback(() => {
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      recorder.onstop = null;
      recorder.stop();
    }
    chunksRef.current = [];
    teardown();
    setState("idle");
  }, [teardown]);

  useEffect(() => teardown, [teardown]);

  return { state, error, levelRef, start, stop, cancel };
}
