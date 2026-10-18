import { MAX_TRANSCRIPTION_FILE_SIZE } from "@/lib/audio-transcription";

const LANGUAGES = new Set(["English", "Spanish", "French", "Japanese"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export async function POST(request: Request) {
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > MAX_TRANSCRIPTION_FILE_SIZE + 1_024) {
    return Response.json(
      {
        error:
          "This recording is too large to transcribe. Try a shorter recording.",
      },
      { status: 413 },
    );
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return Response.json(
      { error: "Send a valid audio recording." },
      { status: 400 },
    );
  }

  const audio = formData.get("audio");
  const language = formData.get("language");
  if (
    !(audio instanceof File) ||
    audio.type !== "audio/wav" ||
    audio.size === 0 ||
    audio.size > MAX_TRANSCRIPTION_FILE_SIZE ||
    typeof language !== "string" ||
    !LANGUAGES.has(language)
  ) {
    return Response.json(
      { error: "The audio recording or language is invalid." },
      { status: 400 },
    );
  }

  const apiKey = process.env.PERCEPTRON_API_KEY;
  if (!apiKey) {
    return Response.json(
      {
        error:
          "Transcription is not configured. Add PERCEPTRON_API_KEY to the server environment.",
      },
      { status: 503 },
    );
  }

  try {
    const audioBytes = Buffer.from(await audio.arrayBuffer());
    const response = await fetch(
      "https://api.perceptron.inc/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "perceptron-mk1.5",
          reasoning_effort: "none",
          max_completion_tokens: 4_096,
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "input_audio",
                  input_audio: {
                    data: audioBytes.toString("base64"),
                    format: "wav",
                  },
                },
                {
                  type: "text",
                  text: `Transcribe the speech verbatim in ${language}. Preserve spoken repetitions and do not summarize or translate. Mark words you cannot hear clearly as [unclear] instead of guessing. If there is no intelligible speech, say so. Return only the transcript.`,
                },
              ],
            },
          ],
        }),
        signal: AbortSignal.any([
          request.signal,
          AbortSignal.timeout(60_000),
        ]),
        cache: "no-store",
      },
    );

    if (!response.ok) {
      return Response.json(
        {
          error:
            "Perceptron could not transcribe this recording. Try again in a moment.",
        },
        { status: 502 },
      );
    }

    const result: unknown = await response.json();
    if (!isRecord(result) || !Array.isArray(result.choices)) {
      return Response.json(
        { error: "Perceptron returned an invalid transcript." },
        { status: 502 },
      );
    }

    const choice = result.choices[0];
    if (
      !isRecord(choice) ||
      choice.finish_reason !== "stop" ||
      !isRecord(choice.message) ||
      typeof choice.message.content !== "string"
    ) {
      return Response.json(
        { error: "Perceptron returned an incomplete transcript." },
        { status: 502 },
      );
    }

    const transcript = choice.message.content.trim();
    if (!transcript) {
      return Response.json(
        {
          error:
            "Perceptron could not find intelligible speech in this recording.",
        },
        { status: 422 },
      );
    }

    return Response.json({ transcript });
  } catch {
    return Response.json(
      {
        error:
          "Audio transcription is temporarily unavailable. Try again in a moment.",
      },
      { status: 502 },
    );
  }
}
