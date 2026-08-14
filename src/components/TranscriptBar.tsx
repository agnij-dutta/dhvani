"use client";

import { motion } from "framer-motion";
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
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      className={cn("flex flex-wrap items-baseline gap-x-4 gap-y-2", className)}
    >
      <span className="tag shrink-0">heard</span>
      <p className="min-w-0 flex-1 text-[17px] leading-snug text-paper">
        {text || "—"}
      </p>
      {languageCode && (
        <span className="tag shrink-0 border border-line-soft px-2 py-1 text-saffron">
          {languageName(languageCode)}
          <span className="ml-1.5 text-faint">{languageCode}</span>
        </span>
      )}
    </motion.div>
  );
}
