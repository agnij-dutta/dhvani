// Three guardrail gates, one per pipeline phase.
//
//   guardInput      pre-retrieval  — empty / unsafe / prompt-injection  (sync, <1ms)
//   guardRetrieval  post-retrieval — off-topic (top score below threshold)
//   checkGrounding  post-generation — is the answer actually supported by context
//
// All three are cheap on purpose: they sit inside the <200ms retrieval budget,
// so no model calls, no network, no regex backtracking bombs.

import type { GuardrailVerdict, RetrievedChunk } from "@/lib/types";

const OK: GuardrailVerdict = { ok: true };

const MIN_QUERY_CHARS = 3;

/**
 * Off-topic threshold on e5 cosine similarity.
 *
 * multilingual-e5-small produces a *compressed* similarity range: an unrelated
 * query/passage pair lands around 0.70-0.76, a genuinely relevant one around
 * 0.86-0.90. There is no "0.2 vs 0.9" gap to exploit like with older encoders.
 * 0.80 sits in the middle of that band — high enough to reject nonsense, low
 * enough not to refuse a real but awkwardly-phrased question. Tunable via
 * OFF_TOPIC_THRESHOLD when the corpus changes.
 */
export const OFF_TOPIC_THRESHOLD = Number(process.env.OFF_TOPIC_THRESHOLD ?? 0.8);

/** Groundedness floor: fraction of answer content words found in the context. */
export const GROUNDING_THRESHOLD = Number(process.env.GROUNDING_THRESHOLD ?? 0.55);

export const OFF_TOPIC_MESSAGE =
  "That's outside my knowledge base — I can only answer from the passages I've indexed. Try rephrasing, or ask about something covered by the corpus.";

export const UNSAFE_MESSAGE =
  "I can't help with that request. Ask me something I can answer from the indexed passages.";

export const INJECTION_MESSAGE =
  "That request looks like an attempt to change my instructions. I only answer questions from the indexed passages.";

export const EMPTY_MESSAGE = "I didn't catch a question there — say or type something a bit longer.";

export const UNGROUNDED_MESSAGE =
  "I couldn't find enough support for an answer in the retrieved passages, so I'd rather not guess.";

// --- unsafe-content patterns ----------------------------------------------
// Deliberately narrow: these match *instruction-seeking* phrasing, not mere
// mention of a topic, so "what caused the 1943 famine" is not flagged while
// "how do I make a pipe bomb" is. Kept in one place so it can be reviewed as
// a policy artifact rather than hunted through the code.

const UNSAFE_PATTERNS: readonly RegExp[] = [
  // violence / weapons instruction
  /\bhow (?:do i|to|can i)\b[^?]{0,60}\b(?:make|build|construct|synthesi[sz]e)\b[^?]{0,40}\b(?:bomb|explosive|ied|napalm|nerve agent|chemical weapon|biological weapon|silencer|ghost gun)\b/i,
  /\bhow (?:do i|to|can i)\b[^?]{0,60}\b(?:kill|murder|poison|assassinate|maim)\b\s+(?:a\s+)?(?:someone|somebody|a person|people|my|him|her|them)\b/i,
  /\b(?:untraceable poison|undetectable poison|get away with murder)\b/i,
  // self-harm
  /\bhow (?:do i|to|can i)\b[^?]{0,40}\b(?:kill myself|end my life|commit suicide|hang myself|overdose)\b/i,
  /\b(?:best|painless|easiest|quickest) (?:way|method)s? to (?:die|kill myself|end (?:it|my life)|commit suicide)\b/i,
  /\bhow much\b[^?]{0,40}\bto overdose\b/i,
  // sexual content involving minors — zero tolerance, matches any co-occurrence
  /\b(?:child|children|minor|minors|underage|preteen|pre-teen|teen|teenage|kid|kids|toddler|infant|\d{1,2}[- ]year[- ]old)\b[^.?!]{0,60}\b(?:sexual|sexually|sex|porn|pornographic|nude|nudes|naked|erotic|explicit|molest|groom|grooming)\b/i,
  /\b(?:sexual|sexually|sex|porn|pornographic|nude|nudes|naked|erotic|explicit|molest|groom|grooming)\b[^.?!]{0,60}\b(?:child|children|minor|minors|underage|preteen|pre-teen|teen|teenage|kid|kids|toddler|infant|\d{1,2}[- ]year[- ]old)\b/i,
  // targeted hate / slurs — matched as hostile constructions rather than a
  // slur wordlist, which would itself be a liability sitting in the repo.
  /\b(?:all|every)\s+(?:muslims?|hindus?|christians?|jews?|dalits?|blacks?|whites?|asians?|immigrants?|gays?|lesbians?|trans(?:gender)?(?:\s+people)?)\s+(?:are|should be)\b[^.?!]{0,40}\b(?:killed|exterminated|deported|subhuman|vermin|scum|animals?|inferior)\b/i,
  /\bwhy are\s+(?:muslims?|hindus?|christians?|jews?|dalits?|blacks?|whites?|asians?|immigrants?|gays?|lesbians?|trans(?:gender)?(?:\s+people)?)\s+so\s+(?:stupid|dirty|evil|subhuman|inferior|worthless)\b/i,
  /\b(?:genocide|ethnic cleansing)\b[^.?!]{0,30}\b(?:plan|how to|guide|instructions?)\b/i,
  // illicit-drug / malware synthesis instruction
  /\bhow (?:do i|to|can i)\b[^?]{0,50}\b(?:synthesi[sz]e|cook|manufacture)\b[^?]{0,30}\b(?:meth|methamphetamine|fentanyl|heroin|lsd)\b/i,
  /\bwrite\b[^.?!]{0,30}\b(?:ransomware|keylogger|malware|computer virus)\b/i,
];

// --- prompt-injection patterns --------------------------------------------
// The "ignore previous instructions" family, plus role-override and
// system-prompt-exfiltration attempts.

const INJECTION_PATTERNS: readonly RegExp[] = [
  /\b(?:ignore|disregard|forget|override|bypass)\b[^.?!]{0,30}\b(?:previous|prior|above|earlier|all|any|your)\b[^.?!]{0,20}\b(?:instructions?|prompts?|rules?|directions?|guidelines?|constraints?)\b/i,
  /\b(?:you are|act as|pretend to be|roleplay as|behave as)\b[^.?!]{0,30}\b(?:now|instead)\b[^.?!]{0,30}\b(?:a |an )?(?:different|unrestricted|uncensored|jailbroken|dan|developer mode)\b/i,
  /\bdeveloper mode\b|\bjailbreak\b|\bdo anything now\b/i,
  /\b(?:reveal|show|print|repeat|output|reproduce|leak)\b[^.?!]{0,30}\b(?:your |the )?(?:system|initial|original|hidden|secret)\b[^.?!]{0,15}\b(?:prompt|instructions?|message|rules?)\b/i,
  /\bnew instructions?\s*:/i,
  /\b(?:end|stop)\s+(?:of\s+)?(?:context|passages?)\b[^.?!]{0,20}\b(?:new|now)\b/i,
  /<\|(?:im_start|im_end|system|endoftext)\|>/i,
  /^\s*(?:system|assistant)\s*:/i,
];

/**
 * Pre-retrieval input gate. Pure/sync — no allocations beyond a lowercase copy,
 * regexes are anchored and bounded so worst case is microseconds.
 */
export function guardInput(text: string): GuardrailVerdict {
  const trimmed = (text ?? "").trim();

  if (trimmed.length === 0) {
    return { ok: false, reason: "empty_query", message: EMPTY_MESSAGE };
  }
  if (trimmed.length < MIN_QUERY_CHARS) {
    return { ok: false, reason: "empty_query", message: EMPTY_MESSAGE };
  }

  for (const re of UNSAFE_PATTERNS) {
    if (re.test(trimmed)) {
      return { ok: false, reason: "unsafe_input", message: UNSAFE_MESSAGE };
    }
  }

  for (const re of INJECTION_PATTERNS) {
    if (re.test(trimmed)) {
      return { ok: false, reason: "unsafe_input", message: INJECTION_MESSAGE };
    }
  }

  return OK;
}

/**
 * Post-retrieval topical gate. Zero chunks or a weak top score means the
 * question isn't about anything we indexed.
 */
export function guardRetrieval(
  chunks: RetrievedChunk[],
  threshold = OFF_TOPIC_THRESHOLD,
): GuardrailVerdict {
  if (!chunks || chunks.length === 0) {
    return { ok: false, reason: "off_topic", message: OFF_TOPIC_MESSAGE };
  }
  const top = chunks[0].score;
  if (!Number.isFinite(top) || top < threshold) {
    return { ok: false, reason: "off_topic", message: OFF_TOPIC_MESSAGE };
  }
  return OK;
}

// --- grounding -------------------------------------------------------------

const STOPWORDS = new Set(
  (
    "a about above after again against all am an and any are aren't as at be because been before being below " +
    "between both but by can cannot could couldn't did didn't do does doesn't doing don't down during each few " +
    "for from further had hadn't has hasn't have haven't having he her here hers herself him himself his how " +
    "however i if in into is isn't it its itself just let's me more most mustn't my myself no nor not of off on " +
    "once only or other ought our ours ourselves out over own same shan't she should shouldn't so some such than " +
    "that that's the their theirs them themselves then there these they this those through to too under until up " +
    "very was wasn't we were weren't what when where which while who whom why with won't would wouldn't you your " +
    "yours yourself yourselves also may might must shall will can't been being upon within without according " +
    "generally typically often usually approximately around about known called used using use"
  ).split(" "),
);

const REFUSAL_MARKERS = [
  "NOT_IN_CONTEXT",
  OFF_TOPIC_MESSAGE,
  UNGROUNDED_MESSAGE,
  UNSAFE_MESSAGE,
  INJECTION_MESSAGE,
  EMPTY_MESSAGE,
];

export function isRefusal(answer: string): boolean {
  const a = (answer ?? "").trim();
  if (!a) return true;
  return REFUSAL_MARKERS.some((m) => a.includes(m));
}

/** Words that carry meaning: not stopwords, not citation markers. Numbers kept. */
function contentWords(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/\[\d+\]/g, " ") // strip [1][2] citations
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .split(" ")
    .filter((w) => w.length > 1 && !STOPWORDS.has(w));
}

export interface GroundingResult {
  score: number;
  grounded: boolean;
}

/**
 * Lexical groundedness: what fraction of the answer's content words actually
 * appear in the retrieved text. Crude but fast and surprisingly effective at
 * catching a model that wandered off into parametric memory — a hallucinated
 * entity or number simply won't be in the context.
 *
 * A refusal is grounded by definition (it asserts nothing).
 */
export function checkGrounding(
  answer: string,
  chunks: RetrievedChunk[],
  threshold = GROUNDING_THRESHOLD,
): GroundingResult {
  if (isRefusal(answer)) return { score: 1, grounded: true };

  const words = contentWords(answer);
  if (words.length === 0) return { score: 0, grounded: false };

  const haystack = new Set(
    contentWords(chunks.map((c) => c.parentText ?? c.text).join(" \n ")),
  );
  if (haystack.size === 0) return { score: 0, grounded: false };

  let hits = 0;
  for (const w of words) if (haystack.has(w)) hits++;

  const score = hits / words.length;
  return { score, grounded: score >= threshold };
}
