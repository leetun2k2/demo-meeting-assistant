import type { Metadata } from "next";
import LandingPage from "@/components/LandingPage";

export const metadata: Metadata = {
  title: "NexusAI Meeting Intelligence | Turn Audio into Actionable Insights",
  description:
    "AI-powered meeting assistant with live recording, multimodal audio ingestion, speaker diarization, executive summaries, and action tracking via Google Gemini.",
};

export default function Home() {
  return <LandingPage />;
}
