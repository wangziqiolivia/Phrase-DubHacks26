export const MAX_SCENE_BODY_BYTES = 2 * 1024 * 1024;
export const MAX_FRAME_BYTES = 250 * 1024;
export const MAX_SCENE_TEXT_LENGTH = 4000;
export const MAX_SCENE_DURATION_SECONDS = 450;

export interface SceneFrame {
  timestamp_ms: number;
  image_url: string;
}

export interface SceneRequest {
  text: string;
  language: string;
  frames: SceneFrame[];
}

export interface SceneFeedback {
  scene_description: string;
  suggested_expression: string;
  explanation: string;
  useful_phrases: string[];
  visual_context_available: boolean;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isSceneRequest(value: unknown): value is SceneRequest {
  if (!isObject(value) || typeof value.text !== "string" ||
    value.text.length > MAX_SCENE_TEXT_LENGTH ||
    typeof value.language !== "string" ||
    !["English", "Spanish", "French", "Japanese"].includes(value.language) ||
    !Array.isArray(value.frames) || value.frames.length < 1 || value.frames.length > 6) return false;
  let previous = -1;
  return value.frames.every((frame: unknown) => {
    if (!isObject(frame) || typeof frame.timestamp_ms !== "number" ||
      !Number.isInteger(frame.timestamp_ms) || frame.timestamp_ms < previous ||
      frame.timestamp_ms < 0 || frame.timestamp_ms > MAX_SCENE_DURATION_SECONDS * 1000 ||
      typeof frame.image_url !== "string" ||
      frame.image_url.length > Math.ceil(MAX_FRAME_BYTES / 3) * 4 + 23 ||
      !/^data:image\/jpeg;base64,(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(frame.image_url)) return false;
    const bytes = atob(frame.image_url.slice(23));
    if (bytes.length < 4 || bytes.length > MAX_FRAME_BYTES ||
      bytes.charCodeAt(0) !== 255 || bytes.charCodeAt(1) !== 216 ||
      bytes.charCodeAt(bytes.length - 2) !== 255 || bytes.charCodeAt(bytes.length - 1) !== 217) return false;
    previous = frame.timestamp_ms;
    return true;
  });
}

export function isSceneFeedback(value: unknown): value is SceneFeedback {
  if (!isObject(value)) return false;
  return ["scene_description", "suggested_expression", "explanation"].every(
    (key) => typeof value[key] === "string" && value[key].trim().length > 0 && value[key].length <= 2000,
  ) && typeof value.visual_context_available === "boolean" &&
    Array.isArray(value.useful_phrases) && value.useful_phrases.length <= 3 &&
    value.useful_phrases.every((phrase: unknown) => typeof phrase === "string" && phrase.trim().length > 0 && phrase.length <= 200);
}

export function sampleTimes(duration: number): number[] {
  if (!Number.isFinite(duration) || duration <= 0 || duration > MAX_SCENE_DURATION_SECONDS) {
    throw new Error("Scene analysis supports videos up to 7 minutes 30 seconds.");
  }
  const count = Math.min(6, Math.max(2, Math.ceil(duration / 5)));
  return Array.from({ length: count }, (_, index) => duration * (index + 0.5) / count);
}

export const SCENE_RESPONSE_SCHEMA = {
  type: "object", additionalProperties: false,
  properties: {
    scene_description: { type: "string" },
    suggested_expression: { type: "string" },
    explanation: { type: "string" },
    useful_phrases: { type: "array", items: { type: "string" } },
    visual_context_available: { type: "boolean" },
  },
  required: ["scene_description", "suggested_expression", "explanation", "useful_phrases", "visual_context_available"],
};
