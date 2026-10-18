import { SCENE_COACH_PROMPT } from "./scene-coach";

export const LIVE_FEEDBACK_PROMPT = SCENE_COACH_PROMPT + `
This is live practice. You receive a recent batch of timestamped camera images sampled about every 0.5 seconds and the latest recognized speech.
Describe only this recent window. Do not invent movement between sampled frames or assume the batch covers the entire session.
Give a short, immediately useful suggestion focused on the most recent visible scene. Keep each text field to one or two short sentences.`;
