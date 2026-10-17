export type TranscriptFilter = "full" | "mistakes";

export type TextSize = "sm" | "md" | "lg";

export interface TranscriptSegment {
  id: string;
  timestamp: string;
  text: string;
  isMistake: boolean;
  correction?: string;
}

export const SAMPLE_SESSION_TITLE = "Morning standup — Oct 17";

export const SAMPLE_TRANSCRIPT: TranscriptSegment[] = [
  {
    id: "1",
    timestamp: "0:04",
    text: "Good morning everyone, thanks for joining the standup.",
    isMistake: false,
  },
  {
    id: "2",
    timestamp: "0:12",
    text: "Yesterday I finished the onboarding flow and merged the PR.",
    isMistake: false,
  },
  {
    id: "3",
    timestamp: "0:22",
    text: "Today I'll work on the recoding studio page and the transcript review.",
    isMistake: true,
    correction: "recording",
  },
  {
    id: "4",
    timestamp: "0:31",
    text: "We need to ship the voice mode toggle before the hackathon demo.",
    isMistake: false,
  },
  {
    id: "5",
    timestamp: "0:39",
    text: "There's one blocker on the API — the endpoint returns 500 intermitantly.",
    isMistake: true,
    correction: "intermittently",
  },
  {
    id: "6",
    timestamp: "0:48",
    text: "I'll pair with Alex after this to debug the auth token refresh.",
    isMistake: false,
  },
  {
    id: "7",
    timestamp: "0:56",
    text: "Any questions? No? Okay, let's sync again tomorrow at nine AM pacific.",
    isMistake: true,
    correction: "Pacific",
  },
];
