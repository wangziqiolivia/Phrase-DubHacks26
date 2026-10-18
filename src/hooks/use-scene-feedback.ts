"use client";

import { useEffect, useState } from "react";
import type { Recording } from "@/context/recording-context";
import { isSceneFeedback, MAX_SCENE_TEXT_LENGTH, MAX_VIDEO_BYTES } from "@/lib/scene-feedback";
import type { SceneState } from "./use-live-scene-feedback";

export function useSceneFeedback(recording: Recording | undefined, ready: boolean, language: string) {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<(SceneState & { key: string }) | null>(null);
  const blob = recording?.blob;
  const text = recording?.transcript ?? "";
  const key = JSON.stringify([recording?.id, text, language, attempt]);
  const enabled = ready && recording?.mode === "video" && !!blob;

  useEffect(() => {
    if (!enabled || !blob) return;
    const controller = new AbortController();
    setState({ key, status: "preparing" });
    void (async () => {
      try {
        if (!blob.size || blob.size > MAX_VIDEO_BYTES) throw new Error("Full-video analysis supports recordings under 20 MiB. Your video is still available locally.");
        if (text.length > MAX_SCENE_TEXT_LENGTH) throw new Error("Video feedback supports transcripts up to 4000 characters. Your full transcript is preserved.");
        const form = new FormData();
        const mime = blob.type.split(";")[0];
        form.set("video", new Blob([blob], { type: mime }), mime === "video/mp4" ? "recording.mp4" : "recording.webm");
        form.set("text", text); form.set("language", language);
        setState({ key, status: "analyzing" });
        const response = await fetch("/api/scene/video", {
          method: "POST", body: form,
          signal: AbortSignal.any([controller.signal, AbortSignal.timeout(120_000)]),
        });
        const result: unknown = await response.json();
        if (!response.ok) throw new Error(typeof result === "object" && result !== null && "error" in result && typeof result.error === "string" ? result.error : "Video analysis could not finish. Please retry.");
        if (!isSceneFeedback(result)) throw new Error("Video analysis returned invalid feedback. Please retry.");
        if (!controller.signal.aborted) setState({ key, status: "complete", feedback: result, hasTranscript: !!text.trim() });
      } catch (cause) {
        if (!controller.signal.aborted) setState({ key, status: "error", error: cause instanceof Error ? cause.message : "Video analysis could not finish. Please retry." });
      }
    })();
    return () => controller.abort();
  }, [blob, enabled, key, language, text]);

  return { state: enabled && state?.key === key ? state : null, retry: () => setAttempt((previous) => previous + 1) };
}
