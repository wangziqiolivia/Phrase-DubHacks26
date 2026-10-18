import { SCENE_COACH_PROMPT } from "./scene-coach";

export const VIDEO_FEEDBACK_PROMPT = SCENE_COACH_PROMPT + `
You receive the complete video recorded by the learner, not a set of screenshots.
Consider visible actions and their order across the clip. Use the separately supplied transcript as the record of what the learner said.
Give one coherent description and a useful natural expression grounded in the full situation. Do not claim to have observed every instant if the input does not establish it.`;
