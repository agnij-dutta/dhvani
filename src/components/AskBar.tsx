"use client";

import { useState } from "react";
import { CornerDownLeft } from "lucide-react";
import { cn } from "./cn";

export function AskBar({
  onSubmit,
  disabled,
  className,
}: {
  onSubmit: (text: string) => void;
  disabled?: boolean;
  className?: string;
}) {
  const [value, setValue] = useState("");

  return (
    <form
      className={cn(
        "group flex items-center gap-3 border-b border-line pb-2 transition-colors focus-within:border-saffron",
        className,
      )}
      onSubmit={(e) => {
        e.preventDefault();
        const text = value.trim();
        if (!text || disabled) return;
        onSubmit(text);
        setValue("");
      }}
    >
      <label htmlFor="ask-text" className="tag shrink-0">
        or type
      </label>
      <input
        id="ask-text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        disabled={disabled}
        autoComplete="off"
        placeholder="What is the boiling point of water at altitude?"
        className="min-w-0 flex-1 bg-transparent text-[15px] text-paper outline-none placeholder:text-faint disabled:opacity-40"
      />
      <button
        type="submit"
        disabled={disabled || !value.trim()}
        className="tag flex shrink-0 items-center gap-1.5 text-saffron transition-opacity disabled:opacity-25"
      >
        Ask
        <CornerDownLeft size={12} strokeWidth={1.6} />
      </button>
    </form>
  );
}
