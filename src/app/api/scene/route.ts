import { isSceneRequest, MAX_SCENE_BODY_BYTES } from "@/lib/scene-feedback";
import { LIVE_FEEDBACK_PROMPT } from "@/lib/prompts/live-feedback";
import { readLimitedBody, requestSceneFeedback } from "@/lib/server/scene-provider";

export async function POST(request: Request) {
  let body: unknown;
  try { body = JSON.parse((await readLimitedBody(request, MAX_SCENE_BODY_BYTES)).toString("utf8")); }
  catch (error) { return Response.json({ error: error instanceof RangeError ? "Scene images are too large." : "Send a valid JSON scene request." }, { status: error instanceof RangeError ? 413 : 400 }); }
  if (!isSceneRequest(body)) return Response.json({ error: "Send up to six ordered JPEG frames, a supported language and a transcript of at most 4000 characters." }, { status: 400 });
  const frames = body.frames.map((frame) => ({ image_url: { url: frame.image_url }, timestamp_ms: frame.timestamp_ms }));
  const visual = frames.length >= 2 ? { type: "video_frames", video_frames: { frames } } : { type: "image_url", image_url: frames[0].image_url };
  return requestSceneFeedback(request, visual, LIVE_FEEDBACK_PROMPT, body.text, body.language);
}
