"use client";

import { motion, useReducedMotion } from "framer-motion";
import { cn } from "./cn";

const LANGUAGES: Record<string, string> = {
  "as-IN": "Assamese",
  "bn-IN": "Bengali",
  "brx-IN": "Bodo",
  "doi-IN": "Dogri",
  "en-IN": "English",
  "gu-IN": "Gujarati",
  "hi-IN": "Hindi",
  "kn-IN": "Kannada",
  "ks-IN": "Kashmiri",
  "kok-IN": "Konkani",
  "mai-IN": "Maithili",
  "ml-IN": "Malayalam",
  "mni-IN": "Manipuri",
  "mr-IN": "Marathi",
  "ne-IN": "Nepali",
  "or-IN": "Odia",
  "pa-IN": "Punjabi",
  "sa-IN": "Sanskrit",
  "sat-IN": "Santali",
  "sd-IN": "Sindhi",
  "ta-IN": "Tamil",
  "te-IN": "Telugu",
  "ur-IN": "Urdu",
};

export function languageName(code: string): string {
  if (!code) return "unknown";
  return LANGUAGES[code] ?? LANGUAGES[`${code.slice(0, 2)}-IN`] ?? code;
}

export function TranscriptBar({
  text,
  languageCode,
  className,
}: {
  text: string;
  languageCode: string;
  className?: string;
}) {
  const shouldReduceMotion = useReducedMotion();

  return (
    <motion.div
      initial={
        shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 6 }
      }
      animate={{ opacity: 1, y: 0 }}
      transition={
        shouldReduceMotion
          ? { duration: 0.18 }
          : { duration: 0.35, ease: [0.16, 1, 0.3, 1] }
      }
      className={cn(
        "flex flex-wrap items-end justify-between gap-x-6 gap-y-3",
        className,
      )}
    >
      <div className="min-w-0 flex-1">
        <span className="tag block">heard</span>
        <p className="mt-1 min-w-0 break-words text-[15px] font-medium leading-6 text-paper [overflow-wrap:anywhere]">
          {text || "—"}
        </p>
      </div>
      {languageCode && (
        <span className="tag shrink-0 rounded-full bg-white px-2.5 py-1 text-faint">
          {languageName(languageCode)}
          <span className="ml-1.5 text-faint">{languageCode}</span>
        </span>
      )}
    </motion.div>
  );
}
