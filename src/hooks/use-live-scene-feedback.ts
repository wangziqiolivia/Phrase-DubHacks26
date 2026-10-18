"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import { startLiveSceneCapture } from "@/lib/live-scene-capture";
import { isSceneFeedback, MAX_SCENE_TEXT_LENGTH, type SceneFeedback } from "@/lib/scene-feedback";

export interface SceneState {
  status: "preparing" | "analyzing" | "complete" | "error";
  feedback?: SceneFeedback;
  error?: string;
  frameCount?: number;
  hasTranscript?: boolean;
}

export function useLiveSceneFeedback(active: boolean, paused: boolean, videoRef: RefObject<HTMLVideoElement | null>, text: string, language: string, selected: boolean) {
  const [state, setState] = useState<SceneState | null>(null);
  const sessionRef = useRef<ReturnType<typeof startLiveSceneCapture> | null>(null);
  const latest = useRef({ text, paused });
  useEffect(() => { latest.current = { text, paused }; }, [text, paused]);
  useEffect(() => () => sessionRef.current?.abort(), []);

  useEffect(() => {
    if (!selected) { sessionRef.current?.abort(); sessionRef.current = null; setState(null); return; }
    if (!active) { sessionRef.current?.finish(); return; }
    sessionRef.current?.abort();
    const video = videoRef.current;
    if (!video) { setState({ status: "error", error: "Camera preview is not ready. Start a new video recording." }); return; }
    setState({ status: "preparing" });
    const session = startLiveSceneCapture(video, {
      isPaused: () => latest.current.paused,
      getText: () => latest.current.text.slice(-MAX_SCENE_TEXT_LENGTH),
      sendFrames: async (frames, transcript, signal) => {
        const response = await fetch("/api/scene", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: transcript, language, frames }),
          signal: AbortSignal.any([signal, AbortSignal.timeout(100_000)]),
        });
        const result: unknown = await response.json();
        if (!response.ok) throw new Error(typeof result === "object" && result !== null && "error" in result && typeof result.error === "string" ? result.error : "Live scene analysis is unavailable.");
        if (!isSceneFeedback(result)) throw new Error("Live scene analysis returned invalid feedback.");
        return result;
      },
      onStatus: () => {
        if (sessionRef.current === session) setState((previous) => ({ ...previous, status: "analyzing", error: undefined }));
      },
      onFeedback: (feedback, frameCount, hasTranscript) => {
        if (sessionRef.current === session) setState({ status: "complete", feedback, frameCount, hasTranscript });
      },
      onError: (error) => {
        if (sessionRef.current === session) setState((previous) => ({ ...previous, status: "error", error: error.message }));
      },
    });
    sessionRef.current = session;
    return () => session.finish();
  }, [active, language, videoRef, selected]);
  return state;
}
