"use client";

import type { Recording } from "@/context/recording-context";
import { useSceneFeedback } from "@/hooks/use-scene-feedback";

export function SceneFeedbackPanel({ recording, isRecording, transcriptionStatus, language }: {
  recording: Recording | undefined;
  isRecording: boolean;
  transcriptionStatus: "idle" | "transcribing" | "error";
  language: string;
}) {
  const ready = !isRecording && transcriptionStatus !== "transcribing" &&
    (!!recording?.transcript || transcriptionStatus === "error");
  const { state, retry } = useSceneFeedback(recording, ready, language);
  if (isRecording || recording?.mode !== "video") return null;
  const feedback = state?.feedback;

  return (
    <section className="scene-feedback" aria-label="Scene language feedback" aria-live="polite">
      <h3>Describe your scene</h3>
      {!state && <p className="scene-feedback-muted">Waiting for your transcript before analyzing the video images…</p>}
      {(state?.status === "preparing" || state?.status === "analyzing") && (
        <p role="status" className="grammar-feedback-status">
          <span className="grammar-feedback-spinner" aria-hidden />
          {state.status === "preparing" ? "Preparing a few images from your video…" : "Looking at your scene and words…"}
        </p>
      )}
      {state?.status === "error" && (
        <div className="grammar-feedback-error" role="status">
          <span>{state.error} Your recording and original words are unchanged.</span>
          <button type="button" onClick={retry}>Try scene analysis again</button>
        </div>
      )}
      {state?.status === "complete" && feedback && (
        <div className="scene-feedback-content">
          <p className="scene-feedback-muted">{feedback.scene_description}</p>
          <div>
            <h4>{recording.transcript?.trim() ? "A natural way to say it" : "Example description — not a transcript"}</h4>
            <p>{feedback.suggested_expression}</p>
          </div>
          <p className="scene-feedback-muted">{feedback.explanation}</p>
          {feedback.useful_phrases.length > 0 && (
            <div>
              <h4>Useful phrases</h4>
              <ul>
                {feedback.useful_phrases.map((phrase, index) => <li key={index}>{phrase}</li>)}
              </ul>
            </div>
          )}
          {!feedback.visual_context_available && <p className="scene-feedback-muted">The images did not provide enough relevant detail; this is text-only help or an example.</p>}
          <p className="scene-feedback-caption">Based on {state.frameCount} sampled images, not every moment of the video.</p>
        </div>
      )}
    </section>
  );
}
