"use client";

import { Fragment, useMemo } from "react";
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
      className={cn("font-display text-[26px] leading-[1.45] text-paper sm:text-[30px]", className)}
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
              document
                .getElementById(`chunk-${part.n}`)
                ?.scrollIntoView({ behavior: "smooth", block: "center" });
            }}
            aria-label={`Source ${part.n}`}
            className={cn(
              "tnum relative -top-[0.55em] mx-[1px] inline-flex h-[17px] min-w-[17px] items-center justify-center rounded-[3px] border px-[3px] text-[10px] leading-none align-baseline transition-colors",
              activeCitation === part.n
                ? "border-saffron bg-saffron text-ink"
                : "border-line text-saffron hover:border-saffron",
            )}
          >
            {part.n}
          </button>
        ),
      )}
      {streaming && (
        <span
          aria-hidden
          className="ml-1 inline-block h-[0.85em] w-[2px] translate-y-[0.06em] animate-[dhv-caret_1s_steps(1)_infinite] bg-saffron align-baseline"
        />
      )}
    </div>
  );
}
