"use client";

import { useState } from "react";
import { IconChevronDownFill18 as ChevronDownIcon } from "nucleo-ui-fill-18/components/IconChevronDownFill18";
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
      tabIndex={-1}
      onMouseEnter={() => onFocusChange?.(index)}
      onMouseLeave={() => onFocusChange?.(null)}
      onFocus={() => onFocusChange?.(index)}
      onBlur={() => onFocusChange?.(null)}
      className={cn(
        "group relative scroll-mt-24 border-t border-line py-5 transition-colors duration-200 first:!border-none",
        active && "text-paper",
      )}
    >
      <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3">
        <span
          className={cn(
            "tnum text-[13px] leading-none transition-colors",
            active ? "text-paper" : "text-faint",
          )}
        >
          {String(index).padStart(2, "0")}
        </span>
        <span className="tag w-fit max-w-full truncate rounded-full bg-white px-2 py-0.5 text-[10px] text-muted">
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
              active ? "bg-paper" : "bg-faint",
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
        id={`chunk-${index}-passage`}
        className={cn(
          "mt-3 text-[13.5px] leading-[1.5] tracking-[-0.015em] text-muted transition-colors",
          active && "text-paper",
          !open && "line-clamp-3",
        )}
      >
        {chunk.text}
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="tag flex min-h-11 shrink-0 items-center gap-1 whitespace-nowrap transition-colors hover:text-paper sm:min-h-8"
          aria-expanded={open}
          aria-controls={`chunk-${index}-passage`}
        >
          {open ? "Collapse" : "Full passage"}
          <ChevronDownIcon
            aria-hidden
            size={11}
            className={cn("transition-transform", open && "rotate-180")}
          />
        </button>
        <span className="tag min-w-0 break-words text-[11px] text-faint sm:ml-auto sm:text-right">
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
