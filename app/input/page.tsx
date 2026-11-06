import type { Metadata } from "next";
import MeetingWorkspace from "@/components/MeetingWorkspace";

export const metadata: Metadata = {
  title: "Meeting Ingestion & Input | NexusAI Meeting Intelligence",
  description:
    "Record audio or upload a meeting recording, provide context notes, and transcribe with Gemini AI.",
};

export default function InputPage() {
  return <MeetingWorkspace />;
}
