"use client";

import type { RefObject } from "react";
import type { Mode, Recording } from "@/context/recording-context";
import { useSceneFeedback } from "@/hooks/use-scene-feedback";
import { useLiveSceneFeedback } from "@/hooks/use-live-scene-feedback";

interface ScenePanelProps {
  recording: Recording | undefined;
  mode: Mode;
  feedbackMode: "after-stop" | "real-time";
  isRecording: boolean;
  isPaused: boolean;
  videoRef: RefObject<HTMLVideoElement | null>;
  liveTranscript: string;
  transcriptionStatus: "idle" | "transcribing" | "error";
  language: string;
}

export function SceneFeedbackPanel({ recording, mode, feedbackMode, isRecording, isPaused, videoRef, liveTranscript, transcriptionStatus, language }: ScenePanelProps) {
  const live = feedbackMode === "real-time";
  const ready = mode === "video" && !live && !isRecording && transcriptionStatus !== "transcribing" &&
    (!!recording?.transcript || transcriptionStatus === "error");
  const videoResult = useSceneFeedback(recording, ready, language);
  const liveState = useLiveSceneFeedback(live && mode === "video" && isRecording, isPaused, videoRef, liveTranscript, language, live && mode === "video");
  if (mode !== "video") return null;
  const state = live ? liveState : videoResult.state;
  const feedback = state?.feedback;

  return (
    <section className="scene-feedback" aria-label="Scene language feedback" aria-live="polite">
      <h3>{live ? "Live scene coach" : "Video scene feedback"}</h3>
      {!state && <p className="scene-feedback-muted">{live
        ? "Start a video recording. Camera images are captured every 0.5 seconds and sent in recent batches."
        : isRecording ? "Your complete video will be sent for analysis after you stop."
          : recording?.mode === "video" ? "Waiting for your transcript before uploading the complete video…"
            : "Record a video to get language suggestions grounded in the scene."}</p>}
      {(state?.status === "preparing" || state?.status === "analyzing") && (
        <p role="status" className="grammar-feedback-status">
          <span className="grammar-feedback-spinner" aria-hidden />
          {live ? isPaused ? "Capture paused. Keeping your latest feedback." : "Analyzing recent camera images…"
            : "Uploading and analyzing your complete video…"}
        </p>
      )}
      {state?.status === "error" && (
        <div className="grammar-feedback-error" role="status">
          <span>{state.error} Your recording and original words are unchanged.</span>
          {!live && <button type="button" onClick={videoResult.retry}>Try video analysis again</button>}
          {live && <span>New frames may resume feedback while recording. Start a new recording if needed.</span>}
        </div>
      )}
      {feedback && (
        <div className="scene-feedback-content">
          <p className="scene-feedback-muted">{feedback.scene_description}</p>
          <div>
            <h4>{state?.hasTranscript ? "A natural way to say it" : "Example description — not a transcript"}</h4>
            <p>{feedback.suggested_expression}</p>
          </div>
          <p className="scene-feedback-muted">{feedback.explanation}</p>
          {feedback.useful_phrases.length > 0 && (
            <div><h4>Useful phrases</h4><ul>{feedback.useful_phrases.map((phrase, index) => <li key={index}>{phrase}</li>)}</ul></div>
          )}
          {!feedback.visual_context_available && <p className="scene-feedback-muted">The visuals did not provide enough relevant detail; this is text-only help or an example.</p>}
          <p className="scene-feedback-caption">{live
            ? `Latest result uses ${state?.frameCount} recent images. Capture targets 2 frames/second; results depend on API latency.`
            : "The complete video was sent for analysis. Your original transcript is unchanged."}</p>
        </div>
      )}
    </section>
  );
}
