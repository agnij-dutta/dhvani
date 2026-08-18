---
name: Dhvani
description: A quiet monochrome voice-retrieval instrument for grounded multilingual answers.
colors:
  primary-charcoal: "#18181b"
  canvas-white: "#ffffff"
  workbench-fog: "#f5f5f5"
  quiet-surface: "#e9e9e9"
  hairline: "#d7d7d7"
  soft-hairline: "#e6e6e6"
  body-gray: "#5f5f63"
  faint-gray: "#6c6c70"
  absolute-black: "#000000"
  rail-charcoal: "#18181d"
  state-strong: "#29292d"
  state-soft: "#4c4c51"
  timing-guard: "#d1d1d4"
  timing-embed: "#a6a6aa"
  timing-retrieve: "#6f6f74"
  timing-first-token: "#202024"
typography:
  display:
    fontFamily: "Open Runde, Arial, sans-serif"
    fontSize: "46px"
    fontWeight: 600
    lineHeight: 0.98
    letterSpacing: "-0.04em"
  headline:
    fontFamily: "Open Runde, Arial, sans-serif"
    fontSize: "40px"
    fontWeight: 400
    lineHeight: 1
    letterSpacing: "-0.025em"
  title:
    fontFamily: "Open Runde, Arial, sans-serif"
    fontSize: "25px"
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: "-0.025em"
  answer:
    fontFamily: "Open Runde, Arial, sans-serif"
    fontSize: "24px"
    fontWeight: 500
    lineHeight: 1.45
    letterSpacing: "-0.025em"
  body:
    fontFamily: "Open Runde, Arial, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "-0.015em"
    fontFeature: "\"ss01\", \"cv01\", \"cv02\""
  label:
    fontFamily: "Open Runde, Arial, sans-serif"
    fontSize: "12px"
    fontWeight: 500
    letterSpacing: "-0.01em"
  numeric:
    fontFamily: "Open Runde, Arial, sans-serif"
    fontSize: "13px"
    fontWeight: 400
    letterSpacing: "-0.025em"
    fontFeature: "\"tnum\""
  wordmark-devanagari:
    fontFamily: "Tiro Devanagari Hindi, serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1
rounded:
  focus: "10px"
  notice: "12px"
  instrument: "14px"
  workbench: "24px"
  capsule: "9999px"
spacing:
  micro: "4px"
  xs: "8px"
  sm: "12px"
  md: "16px"
  lg: "24px"
  xl: "32px"
  2xl: "40px"
  section: "64px"
components:
  navigation-rail:
    backgroundColor: "{colors.rail-charcoal}"
    textColor: "{colors.canvas-white}"
    typography: "{typography.label}"
    rounded: "{rounded.capsule}"
    padding: "0 12px"
    height: "48px"
    width: "min(640px, calc(100% - 32px))"
  button-primary:
    backgroundColor: "{colors.primary-charcoal}"
    textColor: "{colors.canvas-white}"
    typography: "{typography.label}"
    rounded: "{rounded.capsule}"
    padding: "8px 16px"
    height: "40px"
  button-primary-hover:
    backgroundColor: "{colors.absolute-black}"
    textColor: "{colors.canvas-white}"
    typography: "{typography.label}"
    rounded: "{rounded.capsule}"
    padding: "8px 16px"
    height: "40px"
  ask-field:
    backgroundColor: "{colors.canvas-white}"
    textColor: "{colors.primary-charcoal}"
    typography: "{typography.body}"
    rounded: "{rounded.capsule}"
    padding: "8px 8px 8px 20px"
    height: "56px"
  voice-control:
    backgroundColor: "{colors.primary-charcoal}"
    textColor: "{colors.canvas-white}"
    rounded: "{rounded.capsule}"
    size: "112px"
  voice-control-recording:
    backgroundColor: "{colors.canvas-white}"
    textColor: "{colors.primary-charcoal}"
    rounded: "{rounded.capsule}"
    size: "112px"
  pipeline-capsule:
    backgroundColor: "{colors.canvas-white}"
    textColor: "{colors.primary-charcoal}"
    typography: "{typography.label}"
    rounded: "{rounded.capsule}"
    padding: "6px"
  citation-chip:
    backgroundColor: "{colors.canvas-white}"
    textColor: "{colors.primary-charcoal}"
    typography: "{typography.numeric}"
    rounded: "{rounded.capsule}"
    padding: "0 4px"
    height: "18px"
  workbench:
    backgroundColor: "{colors.workbench-fog}"
    textColor: "{colors.primary-charcoal}"
    rounded: "{rounded.workbench}"
    padding: "56px 32px 40px"
  content-card:
    backgroundColor: "{colors.canvas-white}"
    textColor: "{colors.primary-charcoal}"
    rounded: "{rounded.instrument}"
    padding: "24px"
  source-row:
    textColor: "{colors.body-gray}"
    typography: "{typography.body}"
    padding: "20px 0"
  metric-tile:
    backgroundColor: "{colors.workbench-fog}"
    textColor: "{colors.primary-charcoal}"
    rounded: "{rounded.instrument}"
    padding: "20px"
---

# Design System: Dhvani

## Overview

**Creative North Star: "The Quiet Voice Instrument"**

Dhvani is a bright, low-noise operating surface built around one decisive act: asking a question. Generous white space, rounded Open Runde typography, tactile charcoal controls, and precise gray rules make voice retrieval feel direct and calm rather than theatrical or technical.

The interface reveals proof without turning into a dashboard. Transcript, pipeline, grounding, citations, sources, refusal, and timing remain inspectable, while provider detail and HH Goa provenance stay subordinate. The bilingual “Dhvani ध्वनि” mark anchors the product across routes.

**Key Characteristics:**

- Bright white canvas with broad fog-gray work surfaces.
- Ink-black floating navigation and primary controls.
- Rounded, oversized Open Runde type with compact utilitarian labels.
- One restrained concentric voice control as the signature instrument.
- Grounding and performance proof expressed through structure, value, and copy—not chroma.
- Flat content surfaces with ambient lift reserved for floating controls.

## Colors

The palette is deliberately achromatic: value contrast carries hierarchy, state, and data without adding a brand accent.

### Primary

- **Voice Charcoal** (`primary-charcoal`): primary text, the microphone core, active pipeline stages, primary actions, and citation selection.
- **Absolute Black** (`absolute-black`): a small hover-only deepening for decisive actions; never a page background.

### Neutral

- **Canvas White** (`canvas-white`): route backgrounds, input surfaces, floating progress, and cards nested in fog surfaces.
- **Workbench Fog** (`workbench-fog`): broad task areas, the voice plate, quiet hover rows, and metric tiles.
- **Quiet Surface** (`quiet-surface`): disabled or emphasized neutral states.
- **Hairline / Soft Hairline** (`hairline`, `soft-hairline`): structure, dividers, dials, axes, and subordinate rules.
- **Body Gray / Faint Gray** (`body-gray`, `faint-gray`): support copy and metadata; faint gray is never used for essential instructions at small sizes.
- **Rail Charcoal** (`rail-charcoal`): the solid floating navigation capsule.
- **State Strong / State Soft** (`state-strong`, `state-soft`): grounded/pass and warning/refusal semantics, always reinforced by words or icons.
- **Timing Scale** (`timing-guard`, `timing-embed`, `timing-retrieve`, `timing-first-token`): light-to-dark sequence for latency segments.

**The No-Chroma Rule.** Every foreground, surface, border, state, chart, and focus treatment remains neutral gray; success and refusal never depend on hue.

**The Charcoal-on-White Rule.** Default routes stay white with charcoal content. Fog surfaces group work; near-black is reserved for the rail and primary actions.

**The Neutral-State Rule.** Legacy semantic aliases are intentionally remapped to grayscale. Keep their rendered output neutral and pair every state with explicit language.

## Typography

**Display Font:** Open Runde (with Arial, sans-serif fallback)  
**Body Font:** Open Runde (with Arial, sans-serif fallback)  
**Label/Mono Font:** Open Runde (with Arial, sans-serif fallback)

**Character:** Self-hosted Open Runde weights 400–700 supply the product’s soft, contemporary confidence at every scale. Numeric readouts use the same face with tabular figures, keeping the system human while preserving instrument precision; the ध्वनि wordmark alone uses self-hosted Tiro Devanagari Hindi.

### Hierarchy

- **Display** (600, 46px / 64px from 640px, 0.98 line-height): two-line promises and singular route statements; keep the measure compact.
- **Headline** (400, 40px / 52px from 640px, 1 line-height): secondary route titles such as analytics.
- **Title** (600, 25px, 1.25 line-height): refusal and contained-state headings.
- **Answer** (500, 24px / 28px from 640px, 1.45 line-height): streamed answers, capped near 72 characters per line.
- **Body** (400, 15–18px, 1.5–1.65 line-height): prompts, transcript, explanations, and passages.
- **Label** (500–600, 9–13px, tight negative tracking): pipeline stages, tags, actions, and compact metadata. Sentence case is the default.
- **Numeric** (400, contextual 10–64px, tabular figures): timings, scores, counts, and axes.

**The One-Runde Rule.** Use Open Runde for all Latin text—including numeric instruments. Do not introduce a monospace face to make technical detail feel “technical.”

**The Devanagari Mark Rule.** Tiro Devanagari is reserved for the bilingual wordmark; do not fake the script with the Latin fallback.

## Layout

Routes sit on a centered white canvas with generous vertical separation. The canonical console uses a 1240px maximum width with 16px mobile gutters and 24px gutters from 640px; analytics narrows to 1180px with 24px / 32px gutters. The sticky navigation is a centered 640px capsule inset 16px from the viewport edges and top.

The main task flows from a centered voice stage into one broad workbench. Its pipeline overlaps the workbench edge, while the typed fallback sits inside the same task region. Results remain a single column until 1024px, then split into a fluid answer column and a 360px source rail separated by a hairline; the source rail may become sticky. Analytics tiles progress from one to two to four columns, and dense tables scroll horizontally rather than crushing content.

Use the implemented 8 / 12 / 16 / 24 / 32 / 40 / 64px rhythm. At narrow widths, keep the six-stage pipeline intact, hide only secondary rail copy, reduce display and answer type, stack output, and preserve comfortable touch targets.

**The One-Stage Rule.** Give each route one obvious operating stage. Group related proof inside that stage instead of scattering it into competing card grids.

## Elevation & Depth

Depth is a hybrid of tonal layering and a very small shadow vocabulary. Broad work surfaces, content cards, tables, and source rows are flat; only controls that visibly float over the canvas receive ambient lift.

### Shadow Vocabulary

- **Navigation float** (`0 8px 24px rgba(0,0,0,0.14)`): the sticky rail only.
- **Voice control** (`0 12px 32px rgba(0,0,0,0.16)`): idle microphone; hover deepens to `0 16px 38px rgba(0,0,0,0.20)` and recording settles to `0 8px 24px rgba(0,0,0,0.12)`.
- **Pipeline float** (`0 10px 30px rgba(0,0,0,0.11)`): the capsule bridging canvas and workbench.
- **Input rest / focus** (`0 2px 8px rgba(0,0,0,0.06)` / `0 4px 16px rgba(0,0,0,0.10)`): typed fallback and its focus-within state.

**The Floating-Only Rule.** Shadows belong to the rail, voice control, pipeline, and ask field. Content depth comes from tone and spacing.

**The No-Glass Rule.** Use solid fills—no blur, gradient, glow, or translucent glass panel as a substitute for hierarchy.

## Shapes

The form language distinguishes instruments from information. Pills and circles identify controls, progress, tags, and status; rounded rectangles hold content. Use the full capsule for navigation, actions, input, chips, and the six-stage pipeline; a 14px radius for compact cards; and a 24px radius for the broad workbench. Hairline borders articulate lists and evidence without boxing every section.

**The Semantic Silhouette Rule.** Fully round shapes mean action, state, or progress. Content remains in restrained 14px or 24px containers and flat divided rows.

## Components

### Navigation

- **Style:** a 48px-high solid charcoal capsule with the bilingual wordmark on the left and one route action on the right.
- **States:** links use subdued white at rest, a 10% white overlay on hover, and a white 2px focus outline with 3px offset. An active link inverts to white with charcoal text.
- **Responsive:** the product promise in the rail hides below 640px; wordmark and route action remain.

### Voice Control

- **Structure:** a 112px circular core inside a 208px fog plate and 244px dial, centered in a 252px interaction area.
- **States:** idle is charcoal with a restrained 5s breath; recording turns the core white and drives the dial from live microphone level; processing adds a single rotating stroke; blocked uses quiet gray and a mic-off icon.
- **Access:** keep hold, tap-to-latch, Space, and Enter behavior. Disabled, focus, pressed, and status text must remain visible. Reduced motion removes breathing, spin, live scaling, and smooth scrolling while preserving state changes.

### Pipeline Capsule

- **Style:** one white six-column capsule with 6px inset padding and a soft shadow. Waiting is plain, completed stages use fog, and the active stage inverts to charcoal.
- **Typography:** stage labels are 9px on narrow screens and 11px from 640px; timing/state lines are tabular and one step smaller.
- **Behavior:** use words such as “waiting” and “working” in addition to tonal state.

### Inputs / Fields

- **Style:** the typed fallback is a minimum 56px white capsule with 20px leading padding and an inset 40px primary submit control.
- **Focus:** the container shadow strengthens on focus-within; the universal 2px charcoal focus outline remains available to the button.
- **Disabled:** lower opacity while keeping the field and alternate voice/typing relationship understandable.

### Answer, Citations, and Sources

- **Answer:** use medium Open Runde with generous leading and a readable measure; a 2px caret indicates streaming.
- **Citations:** 18px superscript circles invert on hover, focus, or source linkage and scroll to the matching passage.
- **Sources:** use divided rows rather than stacked cards. Pair a two-digit index, strategy pill, score meter, passage excerpt, and explicit expansion control; link focus between citation and passage.
- **Grounding:** present the score and verdict together in a neutral pill. Never imply grounding by color alone.

### Cards / Containers

- **Workbench:** fog background, 24px corners, 56px top inset for the overlapping pipeline, and 16px / 32px horizontal padding across narrow / wide screens.
- **Refusal and notices:** a white 14px card for refusals and a white 12px notice for recoverable failures. Lead with human guidance; place raw provider or microphone detail in a collapsed disclosure.
- **Metrics:** analytics tiles use fog fill, 14px corners, 20px padding, tabular numerals, and no shadow.

### Performance Instruments

- **Latency:** use a light-to-dark four-step gray bar for guard, embed, retrieve, and first token, with an explicit dashed 200ms target line.
- **Analytics:** preserve labels, percentile context, units, pass/over language, and horizontal scrolling. Keep charts and tables flat with hairline structure.

## Do's and Don'ts

### Do:

- Do preserve voice, typed, keyboard, focus, live-status, and reduced-motion paths as equally legitimate ways to operate the product.
- Do keep the bilingual “Dhvani ध्वनि” mark and self-host Open Runde weights 400–700.
- Do make transcript, citations, grounding, source passages, refusal, and latency visibly inspectable.
- Do use broad white space, one fog work surface, hairline structure, and a small number of floating charcoal capsules.
- Do keep technical provenance and “HH Goa 2026 submission” compact and subordinate.

### Don't:

- Don't introduce hue, gradients, glass effects, or a full-screen dark AI cockpit.
- Don't communicate pass, warning, refusal, recording, or grounding through color value alone.
- Don't replace the typed fallback or keyboard microphone behavior with a voice-only interaction.
- Don't turn every information group into a rounded card or add shadows to resting content.
- Don't surface raw provider errors before a plain-language recovery step.
- Don't let hackathon provenance compete with the question, answer, or evidence.
