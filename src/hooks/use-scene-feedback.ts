"use client";

import { useEffect, useState } from "react";
import type { Recording } from "@/context/recording-context";
import { extractVideoFrames } from "@/lib/video-frames";
import { isSceneFeedback, MAX_SCENE_TEXT_LENGTH, type SceneFeedback } from "@/lib/scene-feedback";

type SceneState = {
  key: string;
  status: "preparing" | "analyzing" | "complete" | "error";
  feedback?: SceneFeedback;
  error?: string;
  frameCount?: number;
};

export function useSceneFeedback(recording: Recording | undefined, ready: boolean, language: string) {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<SceneState | null>(null);
  const id = recording?.id;
  const mode = recording?.mode;
  const blob = recording?.blob;
  const text = recording?.transcript ?? "";
  const key = JSON.stringify([id, text, language, attempt]);
  const enabled = ready && mode === "video" && !!blob;

  useEffect(() => {
    if (!enabled || !blob) return;
    const controller = new AbortController();
    setState({ key, status: "preparing" });
    void (async () => {
      try {
        if (text.length > MAX_SCENE_TEXT_LENGTH) throw new Error("Scene feedback supports transcripts up to 4000 characters. Your full transcript is preserved.");
        const frames = await extractVideoFrames(blob, controller.signal);
        controller.signal.throwIfAborted();
        setState({ key, status: "analyzing", frameCount: frames.length });
        const response = await fetch("/api/scene", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text, language, frames }),
          signal: AbortSignal.any([controller.signal, AbortSignal.timeout(70_000)]),
        });
        const result: unknown = await response.json();
        if (!response.ok) {
          const message = typeof result === "object" && result !== null && "error" in result && typeof result.error === "string"
            ? result.error : "Scene analysis could not finish. Please retry.";
          throw new Error(message);
        }
        if (!isSceneFeedback(result)) throw new Error("Scene analysis returned invalid feedback. Please retry.");
        if (!controller.signal.aborted) setState({ key, status: "complete", feedback: result, frameCount: frames.length });
      } catch (cause) {
        if (!controller.signal.aborted) setState({ key, status: "error", error: cause instanceof Error ? cause.message : "Scene analysis could not finish. Please retry." });
      }
    })();
    return () => controller.abort();
  }, [blob, enabled, key, language, text]);

  return { state: enabled && state?.key === key ? state : null, retry: () => setAttempt((previous) => previous + 1) };
}
