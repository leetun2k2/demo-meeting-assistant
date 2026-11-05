import type { MeetingResult } from "@/lib/types";

export interface SpeakerBreakdownItem {
  speaker: string;
  percentage: number;
  duration: string;
  color: string;
}

export const WIREFRAME_V2_RESULT: MeetingResult = {
  status: "completed",
  transcript: [
    {
      startMs: 1000,
      endMs: 7500,
      speaker: "Speaker 1",
      text: "Questions 10 through 24 refer to the following conversation.",
    },
    {
      startMs: 8000,
      endMs: 13500,
      speaker: "Speaker 2",
      text: "Have you figured out how we're getting to the client meeting on Thursday? It starts at 10 so we can't afford to be late.",
    },
    {
      startMs: 14000,
      endMs: 22000,
      speaker: "Speaker 3",
      text: "I've been looking at the train schedule. There are a few options, but since travel expenses have been tight lately, I'd rather not take the express service if we don't have to.",
    },
    {
      startMs: 23000,
      endMs: 32000,
      speaker: "Speaker 2",
      text: "That makes sense. As long as we arrive with enough time to spare, I'm fine with the regular train. We should probably get there at least half an hour early to set up the presentation.",
    },
    {
      startMs: 33000,
      endMs: 42000,
      speaker: "Speaker 3",
      text: "Right. So we need to arrive before 9:30 at the latest. Let me see. Yes, there's one that works perfectly. I'll book the tickets online right now.",
    },
  ],
  summary: {
    title: "Client Meeting – Travel & Presentation Planning",
    executiveSummary:
      "The team finalized transportation plans (take the regular train), agreed to arrive at least 30 minutes early for presentation setup, and assigned next steps for booking tickets and arranging a station pickup.",
    speakerNames: [
      { speakerLabel: "Speaker 1", resolvedName: "Speaker 1" },
      { speakerLabel: "Speaker 2", resolvedName: "Speaker 2" },
      { speakerLabel: "Speaker 3", resolvedName: "Speaker 3" },
    ],
    discussions: [
      "Transportation options and travel expenses",
      "Train schedule and budget constraints",
      "Arrival time and presentation setup requirements",
    ],
    decisions: [
      { text: "Take the regular train instead of the express service", atMs: 23000 },
      { text: "Arrive at least 30 minutes early to set up the presentation", atMs: 23000 },
    ],
    actionItems: [
      {
        task: "Book the train tickets online",
        assignee: "Speaker 3",
        deadline: "Today",
        priority: "High",
        status: "To Do",
      },
      {
        task: "Arrange a taxi to pick them up from the station",
        assignee: "Speaker 3",
        deadline: "Not specified",
        priority: "Medium",
        status: "To Do",
      },
      {
        task: "Confirm presentation setup details (room, device, etc.)",
        assignee: "Speaker 2",
        deadline: "Wed, Feb 5",
        priority: "Medium",
        status: "In Progress",
      },
    ],
    risks: [
      { text: "Train tickets may become limited if not booked soon", atMs: 33000 },
      { text: "Potential delay risks on the day of travel", atMs: 8000 },
    ],
    unresolvedQuestions: [
      { text: "Any backup plan if the train is delayed?", atMs: 8000 },
      { text: "Do we need to bring any additional equipment for the presentation?", atMs: 23000 },
    ],
    keyMoments: [
      { atMs: 0, title: "Intro & agenda", description: "Questions 10 through 24 conversation" },
      { atMs: 8000, title: "Travel options", description: "Schedule and transportation discussion" },
      { atMs: 23000, title: "Arrival & setup time", description: "30-minute early setup requirement" },
      { atMs: 33000, title: "Decisions & next steps", description: "Online ticket booking action agreed" },
    ],
    nextSteps: [
      "Book train tickets online (Owner: Speaker 3)",
      "Arrange a taxi for station pickup (Owner: Speaker 3)",
      "Confirm presentation setup details with the client",
    ],
    followUpEmail: {
      subject: "Follow-up: Client Meeting – Travel & Presentation Planning",
      body: "Hi team,\n\nHere is a recap of our planning session for Thursday's client meeting:\n\nKey Decisions:\n- We will take the regular train instead of the express service to manage budget.\n- We will arrive at least 30 minutes early (before 9:30 AM) to set up the presentation equipment and room.\n\nNext Steps & Action Items:\n- Speaker 3: Book train tickets online today.\n- Speaker 3: Arrange taxi pickup from the station.\n- Speaker 2: Confirm presentation setup details (room, device) with the client by Wed, Feb 5.\n\nBest regards,\nAI Meeting Assistant",
    },
  },
};

export const WIREFRAME_V2_METADATA = {
  meetingTitle: "Client Meeting – Travel & Presentation Planning",
  heroHeading: "Aligned on travel, budget, and presentation setup for the client meeting.",
  date: "Thu, Jan 30, 2025",
  durationFormatted: "32 min",
  speakerCount: 3,
  decisionsCount: 2,
  actionItemsCount: 3,
  themes: ["Travel & Transportation", "Budget", "Presentation Setup"],
  keyTakeaways: [
    "Cost-conscious travel plan (regular train)",
    "Clear timing for arrival and setup (≥ 30 min early)",
    "Actionable next steps with ownership",
  ],
  speakerBreakdown: [
    { speaker: "Speaker 2", percentage: 40, duration: "12.8 min", color: "#475569" },
    { speaker: "Speaker 3", percentage: 38, duration: "12.2 min", color: "#94a3b8" },
    { speaker: "Speaker 1", percentage: 22, duration: "7.0 min", color: "#cbd5e1" },
  ] as SpeakerBreakdownItem[],
  timelineMoments: [
    { time: "00:00", title: "Intro & agenda" },
    { time: "00:08", title: "Travel options" },
    { time: "00:23", title: "Arrival & setup time" },
    { time: "00:33", title: "Decisions & next steps" },
  ],
  recommendations: [
    "Send a confirmation email to the client with travel and setup details.",
    "Add action items to your project tool (Jira / Trello / Notion).",
    "Set a reminder for ticket booking and taxi arrangement.",
  ],
};
