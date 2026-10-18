import { MAX_SCENE_TEXT_LENGTH, MAX_VIDEO_BODY_BYTES, MAX_VIDEO_BYTES } from "@/lib/scene-feedback";
import { VIDEO_FEEDBACK_PROMPT } from "@/lib/prompts/video-feedback";
import { readLimitedBody, requestSceneFeedback } from "@/lib/server/scene-provider";

export async function POST(request: Request) {
  let form: FormData;
  try {
    const bytes = await readLimitedBody(request, MAX_VIDEO_BODY_BYTES);
    form = await new Response(new Uint8Array(bytes), { headers: { "Content-Type": request.headers.get("content-type") ?? "" } }).formData();
  } catch (error) {
    return Response.json({ error: error instanceof RangeError ? "Video is too large. Use a recording under 20 MiB." : "Send a valid video upload." }, { status: error instanceof RangeError ? 413 : 400 });
  }
  const video = form.get("video");
  const text = form.get("text") ?? "";
  const language = form.get("language");
  if (!(video instanceof File) || !video.size || video.size > MAX_VIDEO_BYTES ||
    !["video/webm", "video/mp4"].includes(video.type.split(";")[0]) ||
    typeof text !== "string" || text.length > MAX_SCENE_TEXT_LENGTH ||
    typeof language !== "string" || !["English", "Spanish", "French", "Japanese"].includes(language)) {
    return Response.json({ error: "Send a WebM or MP4 video under 20 MiB, a supported language and at most 4000 transcript characters." }, { status: 400 });
  }
  const bytes = Buffer.from(await video.arrayBuffer());
  const mime = video.type.split(";")[0];
  const validHeader = mime === "video/webm"
    ? bytes.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]))
    : bytes.subarray(4, 8).toString("ascii") === "ftyp";
  if (!validHeader) return Response.json({ error: "The uploaded file is not a supported video." }, { status: 400 });
  // Send the actual complete file inline. No public media URL or storage bucket.
  const visual = { type: "video_url", video_url: { url: `data:${mime};base64,${bytes.toString("base64")}` } };
  return requestSceneFeedback(request, visual, VIDEO_FEEDBACK_PROMPT, text, language);
}
