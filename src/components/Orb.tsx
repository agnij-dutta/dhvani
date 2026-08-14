"use client";

import { useEffect, useRef } from "react";
import { Mic, MicOff } from "lucide-react";
import { cn } from "./cn";

export type OrbMode =
  | "idle"
  | "requesting"
  | "recording"
  | "processing"
  | "blocked";

const BARS = 72;
const CENTER = 100;
const RING_R = 76;
const MAX_LEN = 18;

interface OrbProps {
  mode: OrbMode;
  levelRef: React.RefObject<number>;
  onStart: () => void;
  onStop: () => void;
}

/**
 * Push-to-talk control. Hold to speak, or tap once to latch and tap again to
 * send. The dial around it is a rolling envelope of the last ~3.5s of RMS —
 * a real reading of the mic, not a decorative animation.
 */
export function Orb({ mode, levelRef, onStart, onStop }: OrbProps) {
  const barsRef = useRef<(SVGRectElement | null)[]>([]);
  const coreRef = useRef<HTMLDivElement>(null);
  const glowRef = useRef<HTMLDivElement>(null);

  const heldRef = useRef(false);
  const pressAtRef = useRef(0);
  const latchedRef = useRef(false);
  const pendingStopRef = useRef(false);

  const recording = mode === "recording";

  // Envelope dial: one bar advances per ~3 frames, so the ring holds ~3.5s.
  useEffect(() => {
    if (!recording) {
      barsRef.current.forEach((bar) => {
        if (!bar) return;
        bar.setAttribute("y", String(CENTER - RING_R - 1));
        bar.setAttribute("height", "1");
        bar.setAttribute("opacity", "0.18");
      });
      if (coreRef.current) coreRef.current.style.transform = "";
      if (glowRef.current) glowRef.current.style.opacity = "";
      return;
    }

    let raf = 0;
    let head = 0;
    let frame = 0;

    const tick = () => {
      const level = Math.min(1, Math.max(0, levelRef.current ?? 0));

      if (coreRef.current) {
        coreRef.current.style.transform = `scale(${(1 + level * 0.16).toFixed(4)})`;
      }
      if (glowRef.current) {
        glowRef.current.style.opacity = (0.35 + level * 0.65).toFixed(3);
      }

      if (frame++ % 3 === 0) {
        const bar = barsRef.current[head];
        if (bar) {
          const len = 1.5 + level * MAX_LEN;
          bar.setAttribute("y", String(CENTER - RING_R - len));
          bar.setAttribute("height", len.toFixed(2));
          bar.setAttribute("opacity", "1");
        }
        const trailing = barsRef.current[(head + 6) % BARS];
        if (trailing) trailing.setAttribute("opacity", "0.22");
        head = (head + 1) % BARS;
      }
      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [recording, levelRef]);

  // A long press that outlasted the permission prompt still sends on release.
  useEffect(() => {
    if (recording && pendingStopRef.current) {
      pendingStopRef.current = false;
      onStop();
    }
  }, [recording, onStop]);

  const press = () => {
    if (mode === "processing" || mode === "blocked") return;
    if (recording && latchedRef.current) {
      latchedRef.current = false;
      onStop();
      return;
    }
    if (mode === "idle") {
      heldRef.current = true;
      pressAtRef.current = performance.now();
      latchedRef.current = false;
      onStart();
    }
  };

  const release = () => {
    if (!heldRef.current) return;
    heldRef.current = false;
    const held = performance.now() - pressAtRef.current;
    if (held < 350) {
      latchedRef.current = true;
      return;
    }
    if (recording) onStop();
    else pendingStopRef.current = true;
  };

  const label =
    mode === "recording"
      ? "Stop and send"
      : mode === "processing"
        ? "Working"
        : "Hold to speak";

  return (
    <div className="relative flex h-[272px] w-[272px] items-center justify-center select-none">
      {/* bloom */}
      <div
        ref={glowRef}
        aria-hidden
        className={cn(
          "pointer-events-none absolute h-[210px] w-[210px] rounded-full blur-[52px] transition-opacity duration-500",
          recording ? "bg-saffron/55" : "bg-saffron/20",
        )}
      />

      {/* envelope dial */}
      <svg
        aria-hidden
        viewBox="0 0 200 200"
        className="pointer-events-none absolute h-[272px] w-[272px]"
      >
        <circle
          cx={CENTER}
          cy={CENTER}
          r={RING_R}
          fill="none"
          stroke="currentColor"
          strokeWidth="0.5"
          className="text-line"
        />
        {Array.from({ length: BARS }, (_, i) => (
          <rect
            key={i}
            ref={(el) => {
              barsRef.current[i] = el;
            }}
            x={CENTER - 0.9}
            y={CENTER - RING_R - 1}
            width={1.8}
            height={1}
            rx={0.9}
            opacity={0.18}
            className="fill-saffron"
            transform={`rotate(${(i / BARS) * 360} ${CENTER} ${CENTER})`}
          />
        ))}
        {mode === "processing" && (
          <circle
            cx={CENTER}
            cy={CENTER}
            r={RING_R}
            fill="none"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
            strokeDasharray="34 444"
            className="origin-center text-saffron"
            style={{ animation: "dhv-spin 1.1s linear infinite" }}
          />
        )}
      </svg>

      <button
        type="button"
        aria-label={label}
        aria-pressed={recording}
        disabled={mode === "processing"}
        onPointerDown={(e) => {
          e.preventDefault();
          press();
        }}
        onPointerUp={release}
        onPointerLeave={release}
        onPointerCancel={release}
        onKeyDown={(e) => {
          if ((e.key === " " || e.key === "Enter") && !e.repeat) {
            e.preventDefault();
            press();
          }
        }}
        onKeyUp={(e) => {
          if (e.key === " " || e.key === "Enter") {
            e.preventDefault();
            release();
          }
        }}
        className={cn(
          "relative flex h-[118px] w-[118px] touch-none items-center justify-center rounded-full",
          "border transition-colors duration-300",
          recording
            ? "border-saffron/70 text-ink"
            : "border-line text-saffron hover:border-saffron/50",
          mode === "processing" && "cursor-progress",
          mode === "blocked" && "border-alert/50 text-alert",
        )}
      >
        <div
          ref={coreRef}
          aria-hidden
          className={cn(
            "absolute inset-0 rounded-full transition-[background,opacity] duration-300",
            recording
              ? "bg-[radial-gradient(circle_at_38%_30%,#ffcf8a,#e8891a_46%,#8a4a06_100%)]"
              : "bg-[radial-gradient(circle_at_38%_28%,#3a2a1c,#15100d_72%)]",
            !recording && mode !== "processing" && "animate-[dhv-breathe_5s_ease-in-out_infinite]",
          )}
          style={{ willChange: "transform" }}
        />
        <span className="relative z-10">
          {mode === "blocked" ? (
            <MicOff size={26} strokeWidth={1.4} />
          ) : (
            <Mic size={26} strokeWidth={1.4} />
          )}
        </span>
      </button>
    </div>
  );
}
