"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import type { RetrievedChunk } from "@/lib/types";
import { cn } from "./cn";

export function ChunkCard({
  chunk,
  index,
  active,
  onFocusChange,
}: {
  chunk: RetrievedChunk;
  index: number;
  active?: boolean;
  onFocusChange?: (index: number | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const score = Number.isFinite(chunk.score) ? chunk.score : 0;
  const pct = Math.max(0, Math.min(1, score));

  return (
    <li
      id={`chunk-${index}`}
      onMouseEnter={() => onFocusChange?.(index)}
      onMouseLeave={() => onFocusChange?.(null)}
      className={cn(
        "group relative scroll-mt-24 border-l pl-4 transition-colors duration-200",
        active ? "border-saffron" : "border-line hover:border-faint",
      )}
    >
      <div className="flex items-baseline gap-3">
        <span
          className={cn(
            "tnum text-[13px] leading-none transition-colors",
            active ? "text-saffron" : "text-faint",
          )}
        >
          {String(index).padStart(2, "0")}
        </span>
        <span className="tag border border-line-soft px-1.5 py-0.5 text-[9px] text-muted">
          {chunk.strategy}
        </span>
        <span className="ml-auto flex items-center gap-2">
          <span
            aria-hidden
            className="h-[3px] w-14 overflow-hidden rounded-full bg-line-soft"
          >
            <span
              className={cn(
                "block h-full rounded-full transition-all duration-500",
                active ? "bg-saffron" : "bg-faint",
              )}
              style={{ width: `${pct * 100}%` }}
            />
          </span>
          <span className="tnum text-[12px] text-muted">
            {score.toFixed(3)}
          </span>
        </span>
      </div>

      <p
        className={cn(
          "mt-2 text-[13.5px] leading-[1.65] text-muted transition-colors",
          active && "text-paper",
          !open && "line-clamp-3",
        )}
      >
        {chunk.text}
      </p>

      <div className="mt-2 flex items-center gap-4">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="tag flex items-center gap-1 transition-colors hover:text-saffron"
          aria-expanded={open}
          aria-controls={`chunk-${index}`}
        >
          {open ? "Collapse" : "Full passage"}
          <ChevronDown
            size={11}
            className={cn("transition-transform", open && "rotate-180")}
          />
        </button>
        <span className="tag normal-case tracking-normal text-faint">
          {chunk.queryType || "passage"} · {chunk.langPair}
        </span>
      </div>

      {open && chunk.parentText && chunk.parentText !== chunk.text && (
        <p className="mt-3 border-l border-line-soft pl-3 text-[12.5px] leading-[1.6] text-faint">
          <span className="tag mr-2">parent</span>
          {chunk.parentText}
        </p>
      )}
    </li>
  );
}
