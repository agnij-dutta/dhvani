"use client";

import { useEffect, useRef } from "react";
import { useReducedMotion } from "framer-motion";
import { IconMicrophoneFill18 as MicrophoneIcon } from "nucleo-ui-fill-18/components/IconMicrophoneFill18";
import { IconMicrophoneSlashFill18 as MicrophoneOffIcon } from "nucleo-ui-fill-18/components/IconMicrophoneSlashFill18";
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
  const plateRef = useRef<HTMLDivElement>(null);

  const heldRef = useRef(false);
  const pressAtRef = useRef(0);
  const latchedRef = useRef(false);
  const pendingStopRef = useRef(false);
  const shouldReduceMotion = useReducedMotion();

  const recording = mode === "recording";

  // Envelope dial: one bar advances per ~3 frames, so the ring holds ~3.5s.
  useEffect(() => {
    if (!recording || shouldReduceMotion) {
      barsRef.current.forEach((bar) => {
        if (!bar) return;
        bar.setAttribute("y", String(CENTER - RING_R - 1));
        bar.setAttribute("height", "1");
        bar.setAttribute("opacity", "0.18");
      });
      if (coreRef.current) coreRef.current.style.transform = "";
      if (plateRef.current) {
        plateRef.current.style.opacity = recording ? "1" : "";
      }
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
      if (plateRef.current) {
        plateRef.current.style.opacity = (0.64 + level * 0.36).toFixed(3);
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
  }, [recording, levelRef, shouldReduceMotion]);

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
        : mode === "blocked"
          ? "Microphone unavailable"
          : "Hold to speak";

  return (
    <div className="relative flex h-[252px] w-[252px] items-center justify-center select-none">
      <div
        ref={plateRef}
        aria-hidden
        className="pointer-events-none absolute h-[208px] w-[208px] rounded-full bg-ink-2 transition-opacity duration-500"
      />

      {/* envelope dial */}
      <svg
        aria-hidden
        viewBox="0 0 200 200"
        className="pointer-events-none absolute h-[244px] w-[244px]"
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
            className="fill-paper"
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
            className="origin-center text-paper"
            style={
              shouldReduceMotion
                ? undefined
                : { animation: "dhv-spin 1.1s linear infinite" }
            }
          />
        )}
      </svg>

      <button
        type="button"
        aria-label={label}
        aria-pressed={recording}
        disabled={mode === "processing" || mode === "blocked"}
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
          "relative flex h-[112px] w-[112px] touch-none items-center justify-center rounded-full shadow-[0_12px_32px_rgba(0,0,0,0.16)] transition-[color,box-shadow] duration-300",
          recording
            ? "text-paper shadow-[0_8px_24px_rgba(0,0,0,0.12)]"
            : "text-white hover:shadow-[0_16px_38px_rgba(0,0,0,0.2)]",
          mode === "processing" && "cursor-progress",
          mode === "blocked" && "cursor-not-allowed text-alert shadow-none",
        )}
      >
        <div
          ref={coreRef}
          aria-hidden
          className={cn(
            "absolute inset-0 rounded-full transition-colors duration-300",
            recording ? "bg-white" : "bg-paper",
            mode === "blocked" && "bg-ink-3",
            !shouldReduceMotion &&
              !recording &&
              mode !== "processing" &&
              "animate-[dhv-breathe_5s_ease-in-out_infinite]",
          )}
          style={{ willChange: "transform" }}
        />
        <span className="relative z-10">
          {mode === "blocked" ? (
            <MicrophoneOffIcon size={26} />
          ) : (
            <MicrophoneIcon size={26} />
          )}
        </span>
      </button>
    </div>
  );
}
