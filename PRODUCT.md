# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

People seeking answers across language barriers, especially those who prefer to ask questions by voice in English or one of 22 supported Indic languages. Their core job is to ask naturally and receive a useful answer they can verify without having to translate the question themselves.

## Product Purpose

Dhvani turns a spoken or typed question into a concise, cited answer grounded in the MS MARCO-XI passage corpus. It exists to make multilingual question answering fast, legible, and trustworthy. Success means the user can ask in their own language, understand the result and its supporting passages, and receive a clear refusal when the available evidence cannot support an answer.

## Positioning

Dhvani combines multilingual voice translation, local in-process retrieval, streamed cited answers, explicit guardrail refusals, and visible stage-by-stage latency in one interaction. Its technical proof is measured rather than implied: the retrieval path is benchmarked against a 200 ms target, while speech recognition and full generation timings are reported separately.

## Operating Context

- Users can hold or latch the microphone to speak, use the keyboard to control recording, or type a question when voice is unavailable or undesirable.
- Sarvam translates supported voice input into English before retrieval against the English MS MARCO-XI corpus.
- The answer arrives as a stream alongside the transcript, retrieval progress, source passages, grounding verdict, and latency breakdown.
- A separate analytics view exposes aggregate and recent-run performance for evaluation and technical verification.
- Dhvani is an HH Goa 2026 submission, but that provenance is secondary to the user-facing product and should appear as compact footer attribution.

## Capabilities and Constraints

- Voice questions support English and 22 Indic languages through Sarvam speech-to-text translation; typed questions provide a non-voice path.
- Retrieval uses a local quantized ONNX embedding model and an in-process vector index over MS MARCO-XI. The shipped exact and IVF paths trade retrieval recall against speed according to the available index.
- Generation uses Groq with Gemini as a fallback and streams typed pipeline events to the interface.
- Answers must be supported by retrieved passages. Unsafe, empty, off-topic, and ungrounded requests receive distinct refusal states instead of fabricated answers.
- The corpus bounds what Dhvani can answer. It must not imply knowledge beyond retrieved MS MARCO-XI evidence.
- The existing latency contract defines `ragMs` as guard, embed, retrieve, and time-to-first-token; its target is under 200 ms. Environment-specific measurements must remain clearly distinguished.
- The primary experience should remain clean. Dense implementation details may be compressed into subordinate explanatory text rather than competing with the question-and-answer flow.

## Brand Commitments

- Preserve the product name and bilingual wordmark: “Dhvani ध्वनि.”
- Lead with plain, confident user language; keep benchmark and implementation terminology available but visually subordinate.
- Include compact footer text that identifies the HH Goa submission and summarizes the multilingual, grounded, low-latency mechanism.
- Do not turn hackathon provenance into the product’s main identity.

## Evidence on Hand

- Measured latency results and environment comparisons: `README.md` and `data/bench_results.md`.
- Chunking strategy evaluation against MS MARCO relevance labels: `data/chunking_eval.md`.
- A reproducible benchmark and ingestion/evaluation scripts under `scripts/`.
- Live per-request analytics exposed at `/analytics` and recorded by `src/server/analytics.ts`.
- Guardrail, grounding, retrieval, provider fallback, and streaming behavior implemented under `src/server/`.
- No customer testimonials, adoption figures, press quotes, or production-scale claims are present; future work must not fabricate them.

## Product Principles

1. Let people ask naturally in their own language.
2. Ground every answer or refuse clearly.
3. Prove speed and reliability with inspectable measurements.
4. Keep the core question-and-answer journey simple; place technical provenance in a supporting role.
5. Preserve voice, typing, and keyboard paths so access does not depend on one input method.

## Accessibility & Inclusion

Voice must not be the only way to ask a question. Preserve the typed fallback, keyboard-operable recording control, visible focus treatment, live status semantics, readable error and refusal states, and reduced-motion behavior already present in the interface.
