import { isSceneFeedback, SCENE_RESPONSE_SCHEMA } from "@/lib/scene-feedback";

export async function readLimitedBody(request: Request, limit: number): Promise<Buffer> {
  if (Number(request.headers.get("content-length")) > limit) throw new RangeError("Request too large");
  const reader = request.body?.getReader();
  if (!reader) throw new Error("Missing request body");
  try {
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) { await reader.cancel(); throw new RangeError("Request too large"); }
      chunks.push(value);
    }
    return Buffer.concat(chunks);
  } finally { reader.releaseLock(); }
}

export async function requestSceneFeedback(request: Request, visual: unknown, prompt: string, text: string, language: string): Promise<Response> {
  const apiKey = process.env.PERCEPTRON_API_KEY;
  if (!apiKey) return Response.json({ error: "Scene feedback is not configured on the server." }, { status: 503 });
  try {
    const response = await fetch("https://api.perceptron.inc/v1/chat/completions", {
      method: "POST", headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "perceptron-mk1.5", reasoning_effort: "none", max_completion_tokens: 1200,
        response_format: { type: "json_schema", json_schema: { name: "scene_feedback", strict: true, schema: SCENE_RESPONSE_SCHEMA } },
        messages: [
          { role: "system", content: prompt + ` Write the feedback in ${language}.` },
          { role: "user", content: [visual, { type: "text", text: JSON.stringify({ learner_transcript: text }) }] },
        ],
      }),
      signal: AbortSignal.any([request.signal, AbortSignal.timeout(90_000)]), cache: "no-store",
    });
    if (!response.ok) return Response.json({ error: response.status === 429 ? "Scene analysis is rate limited. Please wait before retrying." : "Scene analysis is unavailable. Your recording is unchanged." }, { status: response.status === 429 ? 429 : 502 });
    const result = await response.json();
    const choice = result?.choices?.[0];
    if (choice?.finish_reason !== "stop" || typeof choice?.message?.content !== "string") {
      return Response.json({ error: "Scene analysis returned an incomplete response. Please retry." }, { status: 502 });
    }
    const feedback: unknown = JSON.parse(choice.message.content);
    if (!isSceneFeedback(feedback)) return Response.json({ error: "Scene analysis returned invalid feedback. Please retry." }, { status: 502 });
    return Response.json(feedback);
  } catch {
    return Response.json({ error: "Scene analysis could not finish. Your recording and transcript are unchanged." }, { status: 502 });
  }
}
