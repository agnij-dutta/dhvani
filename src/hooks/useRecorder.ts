"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { blobToWav } from "@/lib/wav";
import { createVoiceBands, type VoiceBands } from "@/lib/voiceBands";

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
  /** frequency-grouped voice energy for the listening ribbon; never re-renders */
  bandsRef: React.RefObject<VoiceBands>;
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

function follow(
  current: number,
  target: number,
  delta: number,
  attack: number,
  release: number,
): number {
  const rate = target > current ? attack : release;
  return current + (target - current) * Math.min(1, delta * rate);
}

function frequencyBand(
  spectrum: Uint8Array,
  binHz: number,
  lowHz: number,
  highHz: number,
): number {
  const first = Math.max(0, Math.floor(lowHz / binHz));
  const last = Math.min(spectrum.length, Math.ceil(highHz / binHz));
  if (last <= first) return 0;

  let sum = 0;
  for (let index = first; index < last; index++) sum += spectrum[index];
  return sum / (last - first) / 255;
}

function liftVoiceEnergy(value: number): number {
  const lifted = Math.max(0, value - 0.012) * 2.6;
  return Math.min(1, lifted / (1 + lifted * 0.55));
}

export function useRecorder(): UseRecorder {
  const [state, setState] = useState<RecorderState>("idle");
  const [error, setError] = useState<string | null>(null);

  const levelRef = useRef(0);
  const bandsRef = useRef<VoiceBands>(createVoiceBands());
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
    Object.assign(bandsRef.current, createVoiceBands());
  }, []);

  /** RMS plus frequency-grouped metering, kept outside React's render cycle. */
  const startMeter = useCallback(
    (stream: MediaStream) => {
      stopMeter();
      try {
        const ctx = new AudioContext();
        const source = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 1024;
        analyser.smoothingTimeConstant = 0.72;
        source.connect(analyser);

        const waveform = new Uint8Array(analyser.fftSize);
        const spectrum = new Uint8Array(analyser.frequencyBinCount);
        const binHz = ctx.sampleRate / analyser.fftSize;
        let lastFrame = performance.now();
        let previousLevelTarget = 0;

        const tick = (now: number) => {
          const delta = Math.min(0.1, Math.max(1 / 240, (now - lastFrame) / 1000));
          lastFrame = now;
          analyser.getByteTimeDomainData(waveform);
          analyser.getByteFrequencyData(spectrum);

          let sum = 0;
          for (let i = 0; i < waveform.length; i++) {
            const v = (waveform[i] - 128) / 128;
            sum += v * v;
          }
          const rms = Math.sqrt(sum / waveform.length);
          const levelTarget = Math.min(1, rms * 4.2);

          // FFT bins are linear in Hz, so group them by voice ranges rather
          // than slicing the array into thirds.
          const lowTarget = liftVoiceEnergy(
            frequencyBand(spectrum, binHz, 60, 320),
          );
          const midTarget = liftVoiceEnergy(
            frequencyBand(spectrum, binHz, 320, 1600),
          );
          const highTarget = liftVoiceEnergy(
            frequencyBand(spectrum, binHz, 1600, 6000),
          );
          // A fast-changing envelope generally means lively articulation.
          // It lets the animation follow speech pace, not just loudness.
          const cadenceTarget = Math.min(
            1,
            (Math.abs(levelTarget - previousLevelTarget) /
              Math.max(delta, 1 / 120)) *
              0.12 +
              highTarget * 0.38,
          );
          previousLevelTarget = levelTarget;
          const bands = bandsRef.current;
          bands.low = follow(bands.low, lowTarget, delta, 18, 7);
          bands.mid = follow(bands.mid, midTarget, delta, 20, 8);
          bands.high = follow(bands.high, highTarget, delta, 22, 9);
          bands.level = follow(bands.level, levelTarget, delta, 18, 7);
          bands.cadence = follow(
            bands.cadence ?? 0,
            cadenceTarget,
            delta,
            24,
            8,
          );
          levelRef.current = bands.level;

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

  return { state, error, levelRef, bandsRef, start, stop, cancel };
}
