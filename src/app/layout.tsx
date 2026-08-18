import type { Metadata } from "next";
import localFont from "next/font/local";
import { VoiceAnimationTuningProvider } from "@/components/VoiceAnimationTuningProvider";
import { VoiceEdgeGlowFrame } from "@/components/VoiceEdgeGlowFrame";
import "./globals.css";

const openRunde = localFont({
  src: [
    {
      path: "./fonts/OpenRunde-Regular.woff2",
      weight: "400",
      style: "normal",
    },
    {
      path: "./fonts/OpenRunde-Medium.woff2",
      weight: "500",
      style: "normal",
    },
    {
      path: "./fonts/OpenRunde-Semibold.woff2",
      weight: "600",
      style: "normal",
    },
    {
      path: "./fonts/OpenRunde-Bold.woff2",
      weight: "700",
      style: "normal",
    },
  ],
  variable: "--font-open-runde",
  display: "swap",
  fallback: ["Arial"],
});

const deva = localFont({
  src: "./fonts/TiroDevanagariHindi-Regular.woff2",
  variable: "--font-tiro-deva",
  weight: "400",
  style: "normal",
  display: "swap",
  fallback: ["serif"],
});

export const metadata: Metadata = {
  title: "Dhvani — voice RAG",
  description:
    "Ask in English or one of 22 Indic languages. Dhvani transcribes, retrieves, and answers with citations against a 200 ms retrieval target.",
};

const DESIGN_CONTRACT = `THESIS: Dhvani makes multilingual voice retrieval feel as direct as asking a person; it refuses the dark AI-cockpit dashboard. OWN-WORLD: paper white, soft-gray work surfaces, charcoal pills, fine gray rules, Open Runde, fourteen-pixel containers, and capsule controls. STORY: ask aloud or type, follow six stages, read a cited answer or clear refusal, inspect evidence and timing. FIRST VIEWPORT: a floating black pill sits above a centered sixty-four-pixel question, circular voice control, status copy, and a segmented pipeline capsule perched on a broad gray workbench with the typed input. FORM: friendly live-analytics operating console, first of seven grounded directions; the user-pinned Visitors reference overrides seed 067f299d. FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${openRunde.variable} ${deva.variable} h-full antialiased`}
    >
      <body className="flex h-screen">
        <template
          data-design-contract="067f299d"
          dangerouslySetInnerHTML={{
            __html: `<!-- ${DESIGN_CONTRACT} -->`,
          }}
        />
        <VoiceAnimationTuningProvider>
          <VoiceEdgeGlowFrame>{children}</VoiceEdgeGlowFrame>
        </VoiceAnimationTuningProvider>
      </body>
    </html>
  );
}
