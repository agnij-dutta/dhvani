"use client";

import { motion } from "framer-motion";
import { Compass, MicOff, ShieldAlert, Unlink } from "lucide-react";
import type { Refusal } from "@/hooks/useAskStream";
import { cn } from "./cn";

const COPY: Record<
  Refusal["reason"],
  { tag: string; title: string; body: string; Icon: typeof ShieldAlert }
> = {
  off_topic: {
    tag: "off topic",
    title: "That sits outside the index.",
    body: "Dhvani answers only from the MS MARCO-XI passage corpus. Ask something the corpus covers — travel, health, definitions, how-to.",
    Icon: Compass,
  },
  unsafe_input: {
    tag: "unsafe",
    title: "The guard stopped this one.",
    body: "This request can't be answered. Rephrase it without the unsafe part and ask again.",
    Icon: ShieldAlert,
  },
  ungrounded: {
    tag: "ungrounded",
    title: "Nothing retrieved supports an answer.",
    body: "The passages that came back don't contain the fact you asked for. Name the specific thing you want and try again.",
    Icon: Unlink,
  },
  empty_query: {
    tag: "no speech",
    title: "No question came through.",
    body: "Hold the mic until you finish speaking, or type the question instead.",
    Icon: MicOff,
  },
};

export function RefusalPanel({
  refusal,
  className,
}: {
  refusal: Refusal;
  className?: string;
}) {
  const copy = COPY[refusal.reason] ?? {
    tag: refusal.reason,
    title: "Dhvani declined this one.",
    body: "The guardrail refused the request before retrieval.",
    Icon: ShieldAlert,
  };
  const { Icon } = copy;

  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      role="status"
      className={cn(
        "relative border-l-2 border-alert bg-[linear-gradient(90deg,rgba(224,87,74,0.07),transparent_45%)] py-5 pl-5 pr-4",
        className,
      )}
    >
      <div className="flex items-center gap-2.5">
        <Icon size={13} className="text-alert" strokeWidth={1.6} />
        <span className="tag text-alert">{copy.tag}</span>
      </div>
      <h2 className="mt-3 font-display text-[27px] leading-tight text-paper">
        {copy.title}
      </h2>
      <p className="mt-2 max-w-[54ch] text-[14px] leading-[1.65] text-muted">
        {copy.body}
      </p>
      {refusal.message && (
        <p className="tnum mt-4 border-t border-line-soft pt-3 text-[11.5px] leading-relaxed text-faint">
          guard → {refusal.message}
        </p>
      )}
    </motion.section>
  );
}
