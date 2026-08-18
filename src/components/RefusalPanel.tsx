"use client";

import { motion, useReducedMotion } from "framer-motion";
import { IconCompassFill18 as CompassIcon } from "nucleo-ui-fill-18/components/IconCompassFill18";
import { IconLinkBrokenFill18 as LinkBrokenIcon } from "nucleo-ui-fill-18/components/IconLinkBrokenFill18";
import { IconMicrophoneSlashFill18 as MicrophoneOffIcon } from "nucleo-ui-fill-18/components/IconMicrophoneSlashFill18";
import { IconShieldAlertFill18 as ShieldAlertIcon } from "nucleo-ui-fill-18/components/IconShieldAlertFill18";
import type { Refusal } from "@/hooks/useAskStream";
import { cn } from "./cn";

const COPY: Record<
  Refusal["reason"],
  { tag: string; title: string; body: string; Icon: typeof ShieldAlertIcon }
> = {
  off_topic: {
    tag: "off topic",
    title: "That sits outside the index.",
    body: "Dhvani answers only from the MS MARCO-XI passage corpus. Ask something the corpus covers — travel, health, definitions, how-to.",
    Icon: CompassIcon,
  },
  unsafe_input: {
    tag: "unsafe",
    title: "The guard stopped this one.",
    body: "This request can't be answered. Rephrase it without the unsafe part and ask again.",
    Icon: ShieldAlertIcon,
  },
  ungrounded: {
    tag: "ungrounded",
    title: "Nothing retrieved supports an answer.",
    body: "The passages that came back don't contain the fact you asked for. Name the specific thing you want and try again.",
    Icon: LinkBrokenIcon,
  },
  empty_query: {
    tag: "no speech",
    title: "No question came through.",
    body: "Hold the mic until you finish speaking, or type the question instead.",
    Icon: MicrophoneOffIcon,
  },
};

export function RefusalPanel({
  refusal,
  className,
}: {
  refusal: Refusal;
  className?: string;
}) {
  const shouldReduceMotion = useReducedMotion();
  const copy = COPY[refusal.reason] ?? {
    tag: refusal.reason,
    title: "Dhvani declined this one.",
    body: "The guardrail refused the request before retrieval.",
    Icon: ShieldAlertIcon,
  };
  const { Icon } = copy;

  return (
    <motion.section
      initial={
        shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 8 }
      }
      animate={{ opacity: 1, y: 0 }}
      transition={
        shouldReduceMotion
          ? { duration: 0.18 }
          : { duration: 0.35, ease: [0.16, 1, 0.3, 1] }
      }
      role="status"
      className={cn(
        "relative rounded-[14px] bg-white p-6",
        className,
      )}
    >
      <div className="flex items-center gap-2.5">
        <Icon aria-hidden size={14} className="shrink-0 text-alert" />
        <span className="tag rounded-full bg-ink-2 px-2.5 py-1 text-alert">
          {copy.tag}
        </span>
      </div>
      <h2 className="mt-4 font-display text-[25px] font-semibold leading-tight tracking-[-0.025em] text-paper">
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
