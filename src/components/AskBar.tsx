"use client";

import { useState } from "react";
import { IconAddMagicFill18 as AddMagicIcon } from "nucleo-ui-fill-18/components/IconAddMagicFill18";
import { IconReturnKeyFill18 as ReturnKeyIcon } from "nucleo-ui-fill-18/components/IconReturnKeyFill18";
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
        "group flex min-h-14 items-center gap-3 rounded-full bg-white p-2 pl-5 shadow-[0px_8px_24px_0px_rgba(0,0,0,0.10),_0px_0px_0px_1px_rgba(0,0,0,0.02)] transition-[box-shadow]",

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
      <AddMagicIcon aria-hidden size={18} className="shrink-0 text-paper/60" />
      <label htmlFor="ask-text" className="sr-only">
        Type a question
      </label>
      <input
        id="ask-text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        disabled={disabled}
        autoComplete="off"
        placeholder="Type your question…"
        className="min-w-0 flex-1 bg-transparent !text-[15px] text-paper outline-none placeholder:text-faint focus-visible:!outline-none focus-visible:shadow-none disabled:opacity-40 sm:text-[16px]"
      />
      <button
        type="submit"
        disabled={disabled || !value.trim()}
        aria-label="Ask question"
        className="flex h-10 cursor-pointer shrink-0 items-center justify-center rounded-full px-4 text-paper transition-[background-color,color,opacity] opacity-100 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent transition-opacity duration-300"
      >
        <ReturnKeyIcon aria-hidden size={16} />
      </button>
    </form>
  );
}
