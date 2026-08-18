import type { RefObject } from "react";
import type { VoiceAnimationState } from "@/lib/voiceAnimationState";
import {
  VOICE_ANIMATION_TUNING,
  type VoiceWaveTuning,
} from "@/lib/voiceAnimationTuning";
import type { VoiceBands } from "@/lib/voiceBands";
import { FRAG, VERT } from "./shaders";

export type VoiceWaveMode = VoiceAnimationState | "blocked";

const UNIFORMS = [
  "uRes",
  "uTime",
  "uDrift",
  "uLow",
  "uMid",
  "uHigh",
  "uLevel",
  "uPresence",
  "uWake",
  "uWakeLag",
  "uAmplitude",
  "uSpread",
  "uDetail",
  "uBrightness",
  "uReflection",
  "uPaper",
] as const;

type UniformName = (typeof UNIFORMS)[number];

const IDLE_SETTLE_RATE = 5.2;
const SETTLE_EPSILON = 0.004;
const IDLE_DRIFT_SPEED = 0.9;
const ACTIVE_DRIFT_SPEED = 2.1;
const EMPTY_BANDS: VoiceBands = { low: 0, mid: 0, high: 0, level: 0 };

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function isActiveMode(mode: VoiceWaveMode): boolean {
  return mode === "listening" || mode === "thinking";
}

export function shouldRenderWave(
  mode: VoiceWaveMode,
  reducedMotion: boolean,
  wake: number,
  wakeLag: number,
  bands: VoiceBands,
): boolean {
  if (reducedMotion) return false;
  if (isActiveMode(mode)) return true;

  return (
    wake > SETTLE_EPSILON ||
    wakeLag > SETTLE_EPSILON ||
    bands.low > SETTLE_EPSILON ||
    bands.mid > SETTLE_EPSILON ||
    bands.high > SETTLE_EPSILON ||
    bands.level > SETTLE_EPSILON
  );
}

export function advanceWaveDrift(
  drift: number,
  delta: number,
  playbackSpeed: number,
  wake: number,
): number {
  const boundedWake = clamp01(wake);
  const driftSpeed =
    IDLE_DRIFT_SPEED +
    (ACTIVE_DRIFT_SPEED - IDLE_DRIFT_SPEED) * boundedWake;

  return (
    drift +
    Math.max(0, delta) * Math.max(0, playbackSpeed) * driftSpeed
  );
}

function thinkingSignal(time: number, tuning: VoiceWaveTuning): VoiceBands {
  const variation = tuning.thinking.variation;
  const intensity = tuning.thinking.intensity;
  const low =
    (0.52 +
      0.2 * variation * Math.sin(time * 0.73) * Math.sin(time * 0.29 + 0.8)) *
    intensity;
  const mid =
    (0.48 +
      0.18 * variation * Math.sin(time * 1.13 + 1.7) * Math.sin(time * 0.41)) *
    intensity;
  const high =
    (0.42 +
      0.2 * variation * Math.sin(time * 1.67 + 3.1) * Math.sin(time * 0.53 + 2.2)) *
    intensity;

  return {
    low: clamp01(low),
    mid: clamp01(mid),
    high: clamp01(high),
    level: clamp01((low + mid + high) / 2.35),
  };
}

export class VoiceWaveRenderer {
  private readonly host: HTMLElement;
  private readonly bandsRef: RefObject<VoiceBands>;
  private readonly canvas: HTMLCanvasElement;
  private readonly visibilityHandler = () => this.syncPlayback();

  private gl: WebGL2RenderingContext | null = null;
  private program: WebGLProgram | null = null;
  private uniforms = {} as Record<UniformName, WebGLUniformLocation | null>;
  private resizeObserver: ResizeObserver | null = null;
  private intersectionObserver: IntersectionObserver | null = null;
  private animationFrame = 0;
  private lastFrame = 0;
  private running = false;
  private disposed = false;
  private intersecting = true;
  private reducedMotion = false;
  private mode: VoiceWaveMode = "idle";
  private wake = 0;
  private wakeLag = 0;
  private waveTime = 0.28;
  private waveDrift = 0.28 * IDLE_DRIFT_SPEED;
  private renderedBands: VoiceBands = { ...EMPTY_BANDS };
  private tuning = VOICE_ANIMATION_TUNING.wave;

  constructor(host: HTMLElement, bandsRef: RefObject<VoiceBands>) {
    this.host = host;
    this.bandsRef = bandsRef;
    this.canvas = document.createElement("canvas");
    this.canvas.setAttribute("aria-hidden", "true");
    this.canvas.style.cssText =
      "position:absolute;inset:0;display:block;width:100%;height:100%;pointer-events:none";
    host.appendChild(this.canvas);

    const gl = this.canvas.getContext("webgl2", {
      antialias: false,
      alpha: false,
      powerPreference: "low-power",
    });
    if (!gl) {
      this.canvas.remove();
      return;
    }

    const program = this.buildProgram(gl);
    if (!program) {
      this.canvas.remove();
      return;
    }

    this.gl = gl;
    this.program = program;
    gl.useProgram(program);
    for (const name of UNIFORMS) {
      this.uniforms[name] = gl.getUniformLocation(program, name);
    }
    gl.uniform3f(this.uniforms.uPaper, 1, 1, 1);

    this.resize();
    this.renderStill();

    if (typeof ResizeObserver !== "undefined") {
      this.resizeObserver = new ResizeObserver(() => this.resize());
      this.resizeObserver.observe(host);
    }

    if (typeof IntersectionObserver !== "undefined") {
      this.intersectionObserver = new IntersectionObserver(([entry]) => {
        this.intersecting = entry?.isIntersecting ?? true;
        this.syncPlayback();
      });
      this.intersectionObserver.observe(host);
    }

    document.addEventListener("visibilitychange", this.visibilityHandler);
  }

  get ok(): boolean {
    return Boolean(this.gl && this.program);
  }

  setMode(mode: VoiceWaveMode, reducedMotion: boolean): void {
    const modeChanged = mode !== this.mode;
    const motionChanged = reducedMotion !== this.reducedMotion;
    this.mode = mode;
    this.reducedMotion = reducedMotion;

    if (reducedMotion) {
      this.stop();
      if (modeChanged || motionChanged) this.renderStill();
      return;
    }

    this.syncPlayback();
  }

  setTuning(tuning: VoiceWaveTuning): void {
    this.tuning = tuning;
    if (!this.running) this.renderStill();
  }

  private buildProgram(gl: WebGL2RenderingContext): WebGLProgram | null {
    const compile = (type: number, source: string): WebGLShader | null => {
      const shader = gl.createShader(type);
      if (!shader) return null;
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (gl.getShaderParameter(shader, gl.COMPILE_STATUS)) return shader;

      if (process.env.NODE_ENV !== "production") {
        console.error("[voice-wave]", gl.getShaderInfoLog(shader));
      }
      gl.deleteShader(shader);
      return null;
    };

    const vertex = compile(gl.VERTEX_SHADER, VERT);
    const fragment = compile(gl.FRAGMENT_SHADER, FRAG);
    if (!vertex || !fragment) {
      if (vertex) gl.deleteShader(vertex);
      if (fragment) gl.deleteShader(fragment);
      return null;
    }

    const program = gl.createProgram();
    if (!program) return null;
    gl.attachShader(program, vertex);
    gl.attachShader(program, fragment);
    gl.linkProgram(program);
    gl.deleteShader(vertex);
    gl.deleteShader(fragment);

    if (gl.getProgramParameter(program, gl.LINK_STATUS)) return program;
    if (process.env.NODE_ENV !== "production") {
      console.error("[voice-wave]", gl.getProgramInfoLog(program));
    }
    gl.deleteProgram(program);
    return null;
  }

  private resize(): void {
    const gl = this.gl;
    if (!gl || this.disposed) return;

    const width = this.host.clientWidth;
    const height = this.host.clientHeight;
    if (!width || !height) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const bufferWidth = Math.round(width * dpr);
    const bufferHeight = Math.round(height * dpr);
    if (
      this.canvas.width !== bufferWidth ||
      this.canvas.height !== bufferHeight
    ) {
      this.canvas.width = bufferWidth;
      this.canvas.height = bufferHeight;
    }
    gl.viewport(0, 0, bufferWidth, bufferHeight);
    if (!this.running) this.renderStill();
  }

  private renderStill(): void {
    if (!this.ok) return;

    let bands: VoiceBands = EMPTY_BANDS;
    if (this.mode === "listening") {
      bands = { low: 0.28, mid: 0.34, high: 0.24, level: 0.38 };
      this.wake = 0.54;
      this.wakeLag = 0.54;
    } else if (this.mode === "thinking") {
      const intensity = this.tuning.thinking.intensity;
      bands = {
        low: clamp01(0.58 * intensity),
        mid: clamp01(0.52 * intensity),
        high: clamp01(0.46 * intensity),
        level: clamp01(0.64 * intensity),
      };
      this.wake = 0.84;
      this.wakeLag = 0.84;
    } else {
      this.wake = 0;
      this.wakeLag = 0;
    }

    this.copyBands(bands);
    this.draw(this.waveTime, this.renderedBands);
  }

  private draw(time: number, bands: VoiceBands): void {
    const gl = this.gl;
    const program = this.program;
    if (!gl || !program || !this.canvas.width || !this.canvas.height) return;

    gl.useProgram(program);
    gl.uniform2f(
      this.uniforms.uRes,
      this.canvas.width,
      this.canvas.height,
    );
    gl.uniform1f(this.uniforms.uTime, time);
    gl.uniform1f(this.uniforms.uDrift, this.waveDrift);
    gl.uniform1f(this.uniforms.uLow, clamp01(bands.low));
    gl.uniform1f(this.uniforms.uMid, clamp01(bands.mid));
    gl.uniform1f(this.uniforms.uHigh, clamp01(bands.high));
    gl.uniform1f(this.uniforms.uLevel, clamp01(bands.level));
    gl.uniform1f(this.uniforms.uPresence, 1);
    gl.uniform1f(this.uniforms.uWake, this.wake);
    gl.uniform1f(this.uniforms.uWakeLag, this.wakeLag);
    gl.uniform1f(this.uniforms.uAmplitude, this.tuning.amplitude);
    gl.uniform1f(this.uniforms.uSpread, this.tuning.spread);
    gl.uniform1f(this.uniforms.uDetail, this.tuning.detail);
    gl.uniform1f(this.uniforms.uBrightness, this.tuning.brightness);
    gl.uniform1f(this.uniforms.uReflection, this.tuning.reflection);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  private syncPlayback(): void {
    const shouldRun =
      this.ok &&
      !this.disposed &&
      this.intersecting &&
      !document.hidden &&
      shouldRenderWave(
        this.mode,
        this.reducedMotion,
        this.wake,
        this.wakeLag,
        this.renderedBands,
      );

    if (shouldRun) this.start();
    else this.stop();
  }

  private start(): void {
    if (this.running || !this.ok || this.disposed) return;
    this.running = true;
    this.lastFrame = performance.now();

    const tick = (now: number) => {
      if (!this.running) return;
      const delta = Math.min((now - this.lastFrame) / 1000, 1 / 30);
      this.lastFrame = now;
      this.waveTime += delta * Math.max(0, this.tuning.playbackSpeed);

      const active = isActiveMode(this.mode);
      const targetBands =
        this.mode === "thinking"
          ? thinkingSignal(this.waveTime, this.tuning)
          : this.mode === "listening"
            ? this.bandsRef.current
            : EMPTY_BANDS;
      const targetWake =
        this.mode === "thinking"
          ? this.tuning.thinking.wakeBase +
            this.tuning.thinking.wakeVariation *
              Math.sin(this.waveTime * this.tuning.thinking.wakeSpeed)
          : this.mode === "listening"
            ? this.tuning.listening.wakeBase +
              targetBands.level * this.tuning.listening.sensitivity
            : 0;
      const boundedTargetWake = clamp01(targetWake);
      const wakeRate =
        !active
          ? IDLE_SETTLE_RATE
          : boundedTargetWake > this.wake
          ? this.tuning.response.attack
          : this.tuning.response.release;
      this.wake +=
        (boundedTargetWake - this.wake) * Math.min(1, delta * wakeRate);
      this.wakeLag +=
        (this.wake - this.wakeLag) *
        Math.min(
          1,
          delta *
            (active
              ? this.tuning.response.lag
              : Math.max(this.tuning.response.lag, IDLE_SETTLE_RATE)),
        );
      this.waveDrift = advanceWaveDrift(
        this.waveDrift,
        delta,
        this.tuning.playbackSpeed,
        this.wake,
      );

      if (active) {
        this.copyBands(targetBands);
      } else {
        const bandDecay = Math.min(1, delta * IDLE_SETTLE_RATE);
        this.renderedBands.low +=
          (targetBands.low - this.renderedBands.low) * bandDecay;
        this.renderedBands.mid +=
          (targetBands.mid - this.renderedBands.mid) * bandDecay;
        this.renderedBands.high +=
          (targetBands.high - this.renderedBands.high) * bandDecay;
        this.renderedBands.level +=
          (targetBands.level - this.renderedBands.level) * bandDecay;
      }

      const keepRendering = shouldRenderWave(
        this.mode,
        this.reducedMotion,
        this.wake,
        this.wakeLag,
        this.renderedBands,
      );
      if (!keepRendering) {
        this.wake = 0;
        this.wakeLag = 0;
        this.copyBands(EMPTY_BANDS);
      }

      this.draw(this.waveTime, this.renderedBands);
      if (!keepRendering) {
        this.running = false;
        this.animationFrame = 0;
        return;
      }
      this.animationFrame = requestAnimationFrame(tick);
    };

    this.animationFrame = requestAnimationFrame(tick);
  }

  private copyBands(bands: VoiceBands): void {
    this.renderedBands.low = bands.low;
    this.renderedBands.mid = bands.mid;
    this.renderedBands.high = bands.high;
    this.renderedBands.level = bands.level;
  }

  private stop(): void {
    this.running = false;
    if (this.animationFrame) cancelAnimationFrame(this.animationFrame);
    this.animationFrame = 0;
  }

  destroy(): void {
    this.disposed = true;
    this.stop();
    this.resizeObserver?.disconnect();
    this.intersectionObserver?.disconnect();
    document.removeEventListener("visibilitychange", this.visibilityHandler);

    const gl = this.gl;
    if (gl) {
      if (this.program) gl.deleteProgram(this.program);
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    }
    this.program = null;
    this.gl = null;
    this.canvas.remove();
  }
}
