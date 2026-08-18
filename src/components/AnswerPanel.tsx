"use client";

import { Fragment, useMemo } from "react";
import { useReducedMotion } from "framer-motion";
import { cn } from "./cn";

const CITATION = /\[(\d{1,2})\]/g;

/**
 * Streamed answer. Citation markers become superscript chips that light the
 * matching source when hovered or focused.
 */
export function AnswerPanel({
  text,
  streaming,
  maxCitation,
  activeCitation,
  onCitation,
  className,
}: {
  text: string;
  streaming: boolean;
  maxCitation: number;
  activeCitation: number | null;
  onCitation: (index: number | null) => void;
  className?: string;
}) {
  const shouldReduceMotion = useReducedMotion();
  const parts = useMemo(() => {
    const out: Array<{ kind: "text"; value: string } | { kind: "cite"; n: number }> =
      [];
    let last = 0;
    for (const match of text.matchAll(CITATION)) {
      const n = Number(match[1]);
      const at = match.index ?? 0;
      if (at > last) out.push({ kind: "text", value: text.slice(last, at) });
      if (n >= 1 && n <= maxCitation) out.push({ kind: "cite", n });
      else out.push({ kind: "text", value: match[0] });
      last = at + match[0].length;
    }
    if (last < text.length) out.push({ kind: "text", value: text.slice(last) });
    return out;
  }, [text, maxCitation]);

  return (
    <div
      className={cn(
        "max-w-[72ch] font-display text-[18px] font-medium leading-7 tracking-[-0.03em] text-paper",
        className,
      )}
      aria-live="polite"
      aria-busy={streaming}
    >
      {parts.map((part, i) =>
        part.kind === "text" ? (
          <Fragment key={i}>{part.value}</Fragment>
        ) : (
          <button
            key={i}
            type="button"
            onMouseEnter={() => onCitation(part.n)}
            onMouseLeave={() => onCitation(null)}
            onFocus={() => onCitation(part.n)}
            onBlur={() => onCitation(null)}
            onClick={() => {
              const target = document.getElementById(`chunk-${part.n}`);
              target?.scrollIntoView({
                behavior: shouldReduceMotion ? "auto" : "smooth",
                block: "center",
              });
              target?.focus({ preventScroll: true });
            }}
            aria-label={`Source ${part.n}`}
            aria-controls={`chunk-${part.n}`}
            className={cn(
              "tnum relative -top-[0.55em] mx-[2px] inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1 text-[10px] leading-none align-baseline transition-colors",
              activeCitation === part.n
                ? "bg-paper text-white"
                : "bg-white text-paper hover:bg-ink-3",
            )}
          >
            {part.n}
          </button>
        ),
      )}
      {streaming && (
        <span
          aria-hidden
          className="ml-1 inline-block h-[0.85em] w-[2px] translate-y-[0.06em] animate-[dhv-caret_1s_steps(1)_infinite] bg-paper align-baseline"
        />
      )}
    </div>
  );
}
