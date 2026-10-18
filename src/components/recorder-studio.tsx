"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  AudioLines,
  AudioWaveform,
  Check,
  ChevronDown,
  Circle,
  CircleHelp,
  Download,
  Headphones,
  Mic,
  Pause,
  Play,
  Radio,
  RotateCcw,
  Square,
  Trash2,
  Video,
  Waves,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { SceneFeedbackPanel } from "@/components/scene-feedback-panel";
import {
  PRACTICE_LANGUAGES,
  useRecording,
  type Mode,
} from "@/context/recording-context";
import {
  diffGrammarCorrection,
  isGrammarCorrection,
  type GrammarCorrection,
} from "../lib/grammar-feedback";
import {
  convertRecordingToWav,
  MAX_TRANSCRIPTION_DURATION_SECONDS,
} from "../lib/audio-transcription";
import { cn, formatTime } from "@/lib/utils";

const DEMO_FEEDBACK = {
  original: "scenes",
  correction: "scene",
  explanation: "Because you used “a,” the noun should be singular here.",
  tip: "“This is a beautiful view” sounds natural in this moment, too.",
};

async function transcribeAudio(
  audio: Blob,
  language: string,
  signal: AbortSignal,
): Promise<string> {
  const wav = await convertRecordingToWav(audio);
  const formData = new FormData();
  formData.set("audio", wav, "speech.wav");
  formData.set("language", language);

  const response = await fetch("/api/transcribe", {
    method: "POST",
    body: formData,
    signal,
  });
  const result: unknown = await response.json();
  if (!response.ok) {
    const message =
      typeof result === "object" &&
      result !== null &&
      "error" in result &&
      typeof result.error === "string"
        ? result.error
        : "Transcription is unavailable. Try again in a moment.";
    throw new Error(message);
  }
  if (
    typeof result !== "object" ||
    result === null ||
    !("transcript" in result) ||
    typeof result.transcript !== "string"
  ) {
    throw new Error("Transcription returned an invalid response.");
  }
  return result.transcript;
}

export function RecorderStudio() {
  const {
    mode,
    setMode,
    practiceLanguage,
    setPracticeLanguage,
    isRecording,
    isPaused,
    elapsed,
    error,
    recordings,
    streamActive,
    micLevel,
    videoRef,
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
    deleteRecording,
    clearRecordings,
    startPreview,
    stopPreview,
    updateRecordingTranscript,
  } = useRecording();
  const language =
    PRACTICE_LANGUAGES.find(
      (candidate) => candidate.name === practiceLanguage,
    ) ?? PRACTICE_LANGUAGES[0];
  const [feedbackMode, setFeedbackMode] = useState<"after-stop" | "real-time">(
    "after-stop",
  );
  const [transcript, setTranscript] = useState("");
  const [interimTranscript, setInterimTranscript] = useState("");
  const [transcriptionStatus, setTranscriptionStatus] = useState<
    "idle" | "transcribing" | "error"
  >("idle");
  const [transcriptionError, setTranscriptionError] = useState<string | null>(
    null,
  );
  const [transcriptionRetry, setTranscriptionRetry] = useState(0);
  const [grammarCorrections, setGrammarCorrections] = useState<
    GrammarCorrection[]
  >([]);
  const [grammarResultText, setGrammarResultText] = useState("");
  const [grammarStatus, setGrammarStatus] = useState<
    "idle" | "checking" | "complete" | "error"
  >("idle");
  const [grammarError, setGrammarError] = useState<string | null>(null);
  const [grammarRetry, setGrammarRetry] = useState(0);
  const [feedbackOpen, setFeedbackOpen] = useState<
    "correction" | "positive" | null
  >(null);
  const [showDemo, setShowDemo] = useState(true);
  const [expandedRecordingId, setExpandedRecordingId] = useState<string | null>(
    null,
  );
  const wasRecordingRef = useRef(false);
  const transcriptRef = useRef("");
  const recordingAtStartRef = useRef<string | null>(null);
  const recordingFeedbackModeRef = useRef<"after-stop" | "real-time">(
    "after-stop",
  );
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const recognitionActiveRef = useRef(false);
  const recognitionRestartTimerRef = useRef<number | null>(null);
  const liveSpeechNoticeRef = useRef<string | null>(null);
  const transcriptionRequestRef = useRef<AbortController | null>(null);
  const transcriptionRequestKeyRef = useRef<string | null>(null);
  const grammarRequestRef = useRef<AbortController | null>(null);
  const grammarRequestKeyRef = useRef<string | null>(null);
  const grammarCheckedKeyRef = useRef<string | null>(null);
  const grammarTimerRef = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (grammarTimerRef.current !== null)
        window.clearTimeout(grammarTimerRef.current);
      grammarRequestRef.current?.abort();
      transcriptionRequestRef.current?.abort();
      recognitionActiveRef.current = false;
      if (recognitionRestartTimerRef.current !== null) {
        window.clearTimeout(recognitionRestartTimerRef.current);
      }
      recognitionRef.current?.stop();
    },
    [],
  );

  useEffect(() => {
    if (isRecording && !wasRecordingRef.current) {
      recordingAtStartRef.current = recordings[0]?.id ?? null;
      recordingFeedbackModeRef.current = feedbackMode;
      transcriptRef.current = "";
      setTranscript("");
      setInterimTranscript("");
      setTranscriptionStatus("idle");
      setTranscriptionError(null);
      transcriptionRequestRef.current?.abort();
      transcriptionRequestRef.current = null;
      transcriptionRequestKeyRef.current = null;
      setGrammarCorrections([]);
      setGrammarResultText("");
      setGrammarStatus("idle");
      setGrammarError(null);
      grammarRequestRef.current?.abort();
      grammarRequestRef.current = null;
      grammarRequestKeyRef.current = null;
      if (grammarTimerRef.current !== null) {
        window.clearTimeout(grammarTimerRef.current);
        grammarTimerRef.current = null;
      }
      grammarCheckedKeyRef.current = null;
      setFeedbackOpen(null);
      setShowDemo(false);
    }
    wasRecordingRef.current = isRecording;
  }, [feedbackMode, isRecording, recordings]);

  useEffect(() => {
    if (!isRecording || isPaused || feedbackMode !== "real-time") {
      recognitionActiveRef.current = false;
      if (recognitionRestartTimerRef.current !== null) {
        window.clearTimeout(recognitionRestartTimerRef.current);
        recognitionRestartTimerRef.current = null;
      }
      recognitionRef.current?.stop();
      recognitionRef.current = null;
      return;
    }

    const Recognition =
      window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!Recognition) {
      const message =
        "Live transcription isn't supported by this browser. Switch to Perceptron after-stop feedback.";
      liveSpeechNoticeRef.current = message;
      setTranscriptionError(message);
      setTranscriptionStatus("error");
      return;
    }

    liveSpeechNoticeRef.current = null;
    const recognition = new Recognition();
    recognitionRef.current = recognition;
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = language.locale;
    recognitionActiveRef.current = true;

    recognition.onresult = (event) => {
      let finalized = "";
      let interim = "";
      for (
        let index = event.resultIndex;
        index < event.results.length;
        index += 1
      ) {
        const result = event.results[index];
        const words = result[0]?.transcript ?? "";
        if (result.isFinal) finalized += words;
        else interim += words;
      }
      if (finalized.trim()) {
        transcriptRef.current = [transcriptRef.current, finalized.trim()]
          .filter(Boolean)
          .join(" ");
        setTranscript(transcriptRef.current);
        setTranscriptionError(null);
        setTranscriptionStatus("idle");
      }
      setInterimTranscript(interim.trim());
    };

    recognition.onerror = (event) => {
      const speechEvent = event as SpeechRecognitionErrorEvent;
      if (
        speechEvent.error === "not-allowed" ||
        speechEvent.error === "service-not-allowed"
      ) {
        recognitionActiveRef.current = false;
        const message =
          "Microphone access for live transcription was denied. Allow microphone access or switch to Perceptron after-stop feedback.";
        liveSpeechNoticeRef.current = message;
        setTranscriptionError(message);
        setTranscriptionStatus("error");
      } else if (
        speechEvent.error !== "no-speech" &&
        speechEvent.error !== "aborted"
      ) {
        const message =
          "Live transcription stopped unexpectedly. Try switching feedback modes.";
        liveSpeechNoticeRef.current = message;
        setTranscriptionError(message);
        setTranscriptionStatus("error");
      }
    };

    recognition.onend = () => {
      if (!recognitionActiveRef.current) return;
      recognitionRestartTimerRef.current = window.setTimeout(() => {
        if (!recognitionActiveRef.current) return;
        try {
          recognition.start();
        } catch {
          recognitionActiveRef.current = false;
          const message =
            "Live transcription couldn't restart. Try switching feedback modes.";
          liveSpeechNoticeRef.current = message;
          setTranscriptionError(message);
          setTranscriptionStatus("error");
        }
      }, 250);
    };

    try {
      recognition.start();
      setTranscriptionError(null);
      setTranscriptionStatus("idle");
    } catch {
      recognitionActiveRef.current = false;
      const message =
        "Live transcription couldn't start. Try switching feedback modes.";
      liveSpeechNoticeRef.current = message;
      setTranscriptionError(message);
      setTranscriptionStatus("error");
    }

    return () => {
      recognitionActiveRef.current = false;
      if (recognitionRestartTimerRef.current !== null) {
        window.clearTimeout(recognitionRestartTimerRef.current);
        recognitionRestartTimerRef.current = null;
      }
      recognition.stop();
      recognitionRef.current = null;
    };
  }, [feedbackMode, isPaused, isRecording, language.locale]);

  useEffect(() => {
    const recording = recordings[0];
    if (isRecording || !recording) return;
    if (recording.id === recordingAtStartRef.current) {
      setTranscript(recording.transcript ?? "");
      return;
    }
    if (recording.transcript) {
      setTranscript(recording.transcript);
      transcriptRef.current = recording.transcript;
      return;
    }
    if (recordingFeedbackModeRef.current === "real-time") {
      const finalTranscript = transcriptRef.current.trim();
      if (finalTranscript) {
        setTranscript(finalTranscript);
        updateRecordingTranscript(recording.id, finalTranscript, language.name);
        setTranscriptionStatus("idle");
        setTranscriptionError(null);
      } else if (liveSpeechNoticeRef.current) {
        setTranscriptionStatus("error");
        setTranscriptionError(liveSpeechNoticeRef.current);
      } else {
        setTranscriptionStatus("error");
        setTranscriptionError(
          "No speech transcript was captured. Try again or switch to Perceptron after-stop feedback.",
        );
      }
      return;
    }

    const requestKey = `${recording.id}:${language.name}:${transcriptionRetry}`;
    if (transcriptionRequestKeyRef.current === requestKey) return;
    transcriptionRequestRef.current?.abort();

    const controller = new AbortController();
    transcriptionRequestRef.current = controller;
    transcriptionRequestKeyRef.current = requestKey;
    setTranscript("");
    setTranscriptionError(null);
    setTranscriptionStatus("transcribing");

    void (async () => {
      try {
        if (recording.transcriptionAudioUnavailable) {
          throw new Error(
            "Could not prepare this recording’s audio for transcription. The recording is saved.",
          );
        }
        if (recording.duration > MAX_TRANSCRIPTION_DURATION_SECONDS) {
          throw new Error(
            "Transcription currently supports recordings up to 7 minutes 30 seconds. Your recording is saved.",
          );
        }

        const audio = recording.transcriptionAudio ?? recording.blob;
        const finalTranscript = await transcribeAudio(
          audio,
          language.name,
          controller.signal,
        );
        setTranscript(finalTranscript);
        transcriptRef.current = finalTranscript;
        updateRecordingTranscript(recording.id, finalTranscript, language.name);
        setTranscriptionStatus("idle");
      } catch (cause: unknown) {
        if (controller.signal.aborted) return;
        setTranscriptionError(
          cause instanceof Error
            ? cause.message
            : "Transcription is temporarily unavailable. Try again in a moment.",
        );
        setTranscriptionStatus("error");
      } finally {
        if (transcriptionRequestRef.current === controller) {
          transcriptionRequestRef.current = null;
        }
      }
    })();

    return () => controller.abort();
  }, [
    isRecording,
    language.name,
    recordings,
    transcriptionRetry,
    updateRecordingTranscript,
  ]);

  useEffect(() => {
    const recording = recordings[0];
    if (
      isRecording ||
      recordingFeedbackModeRef.current !== "real-time" ||
      !recording ||
      recording.id === recordingAtStartRef.current
    ) {
      return;
    }

    const finalTranscript = transcriptRef.current.trim();
    if (finalTranscript && recording.transcript !== finalTranscript) {
      updateRecordingTranscript(recording.id, finalTranscript, language.name);
    }
  }, [
    isRecording,
    language.name,
    recordings,
    transcript,
    updateRecordingTranscript,
  ]);

  useEffect(() => {
    if (grammarTimerRef.current !== null) {
      window.clearTimeout(grammarTimerRef.current);
      grammarTimerRef.current = null;
    }

    if (feedbackMode === "after-stop" && isRecording) {
      grammarRequestRef.current?.abort();
      grammarRequestRef.current = null;
      grammarRequestKeyRef.current = null;
      setGrammarStatus("idle");
      setGrammarError(null);
      return;
    }

    const text = transcript.trim();
    if (!text) {
      setGrammarStatus("idle");
      setGrammarError(null);
      return;
    }

    const requestKey = `${language.name}:${text}`;
    if (grammarCheckedKeyRef.current === requestKey) return;

    if (
      grammarRequestKeyRef.current &&
      grammarRequestKeyRef.current !== requestKey
    ) {
      grammarRequestRef.current?.abort();
      grammarRequestRef.current = null;
      grammarRequestKeyRef.current = null;
    }

    setGrammarStatus("checking");
    grammarTimerRef.current = window.setTimeout(
      () => {
        if (grammarRequestKeyRef.current === requestKey) return;
        grammarRequestRef.current?.abort();
        const controller = new AbortController();
        grammarRequestRef.current = controller;
        grammarRequestKeyRef.current = requestKey;
        setGrammarError(null);

        void fetch("/api/grammar", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text, language: language.name }),
          signal: controller.signal,
        })
          .then(async (response) => {
            const result: unknown = await response.json();
            if (!response.ok) {
              const message =
                typeof result === "object" &&
                result !== null &&
                "error" in result &&
                typeof result.error === "string"
                  ? result.error
                  : "Grammar feedback is unavailable. Try again in a moment.";
              throw new Error(message);
            }
            if (
              typeof result !== "object" ||
              result === null ||
              !("corrections" in result) ||
              !Array.isArray(result.corrections) ||
              !result.corrections.every(isGrammarCorrection)
            ) {
              throw new Error("Grammar feedback returned an invalid response.");
            }

            grammarCheckedKeyRef.current = requestKey;
            setGrammarCorrections(result.corrections);
            setGrammarResultText(text);
            setGrammarStatus("complete");
          })
          .catch((cause: unknown) => {
            if (controller.signal.aborted) return;
            setGrammarError(
              cause instanceof Error
                ? cause.message
                : "Grammar feedback is temporarily unavailable. Try again in a moment.",
            );
            setGrammarStatus("error");
          })
          .finally(() => {
            if (grammarRequestRef.current === controller) {
              grammarRequestRef.current = null;
              grammarRequestKeyRef.current = null;
            }
          });
      },
      feedbackMode === "real-time" && isRecording ? 1400 : 0,
    );

    return () => {
      if (grammarTimerRef.current !== null) {
        window.clearTimeout(grammarTimerRef.current);
        grammarTimerRef.current = null;
      }
    };
  }, [feedbackMode, grammarRetry, isRecording, language.name, transcript]);

  const beginRecording = () => {
    void startRecording();
  };

  const changeMode = (nextMode: Mode) => {
    if (isRecording || mode === nextMode) return;
    stopPreview();
    setMode(nextMode);
  };

  const bars = Array.from({ length: 46 }, (_, index) => {
    const contour = Math.abs(Math.sin(index * 0.48)) * 0.7 + 0.2;
    return Math.min(1, contour * (0.16 + micLevel * 2.1));
  });
  const canShowFeedback = true;

  return (
    <div className="journal-shell min-h-screen text-white">
      <header className="journal-header">
        <Link href="/" aria-label="Lived home" className="brand-lockup">
          <span className="brand-mark">
            <AudioWaveform aria-hidden />
          </span>
          <span>
            <span className="brand-name">Phrase</span>
            <span className="brand-caption">
              Learn a new language in a natural way.
            </span>
          </span>
        </Link>

        <div className="header-actions">
          <span className="header-note">
            <span className="status-dot" /> Your space, your pace
          </span>
          <Link href="/assistant" className="help-link">
            <CircleHelp size={16} aria-hidden />
            <span>pause and ask personal tutor</span>
          </Link>
        </div>
      </header>

      <main className="studio-main">
        <section className="studio-intro">
          <div>
            <p className="eyebrow">Learn in practice.</p>
            <h1>Learn a new language effortlessly.</h1>
            <p className="intro-copy">
              No boring textbooks. Specially made for beginners.
            </p>
          </div>
          <label className="language-picker">
            <span>Practicing</span>
            <span className="select-wrap">
              <select
                value={language.name}
                onChange={(event) => {
                  const next = PRACTICE_LANGUAGES.find(
                    (item) => item.name === event.target.value,
                  );
                  if (next) setPracticeLanguage(next.name);
                }}
                disabled={isRecording}
                aria-label="Language to practice"
              >
                {PRACTICE_LANGUAGES.map((item) => (
                  <option key={item.name}>{item.name}</option>
                ))}
              </select>
              <ChevronDown size={14} aria-hidden />
            </span>
          </label>
        </section>

        <div className="studio-layout">
          <section className="capture-panel" aria-label="Recording studio">
            <div
              className={cn("capture-stage", mode === "voice" && "voice-stage")}
            >
              {mode === "video" ? (
                <>
                  <video
                    ref={videoRef}
                    muted
                    playsInline
                    className={cn(
                      "camera-feed",
                      !streamActive && "camera-feed-hidden",
                    )}
                    aria-label="Live camera preview"
                  />
                  {!streamActive && (
                    <div className="camera-welcome">
                      <div className="landscape-art" aria-hidden>
                        <span className="landscape-sun" />
                        <span className="landscape-hill hill-back" />
                        <span className="landscape-hill hill-front" />
                      </div>
                      <div className="camera-welcome-content">
                        <span className="welcome-icon">
                          <Video size={18} />
                        </span>
                        <p className="stage-overline">
                          Daily life | self-reflections
                        </p>
                        <h2>Record anything you want to say.</h2>

                        <Button
                          variant="outline"
                          onClick={() => void startPreview("video")}
                          className="camera-start"
                        >
                          <Video size={15} />
                          Start camera
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="voice-welcome">
                  <div
                    className={cn(
                      "voice-orbit",
                      isRecording && !isPaused && "voice-orbit-active",
                    )}
                  >
                    <span className="orbit-ring ring-one" />
                    <span className="orbit-ring ring-two" />
                    <span className="voice-center">
                      <Mic size={25} />
                    </span>
                  </div>
                  <div
                    className="voice-waveform"
                    aria-label={
                      streamActive
                        ? "Microphone input level"
                        : "Microphone not active"
                    }
                  >
                    {bars.map((height, index) => (
                      <span
                        key={index}
                        className={cn(
                          streamActive ? "wave-bar-live" : "wave-bar-idle",
                        )}
                        style={{ height: `${Math.max(6, height * 58)}px` }}
                      />
                    ))}
                  </div>
                  <p className="voice-stage-caption">
                    {isPaused
                      ? "A quiet pause"
                      : isRecording
                        ? "Listening to your story"
                        : "What would you like to talk about today?"}
                  </p>
                  {!streamActive && !isRecording && (
                    <button
                      type="button"
                      className="voice-enable"
                      onClick={() => void startPreview("voice")}
                    >
                      <Headphones size={15} />
                      Check microphone
                    </button>
                  )}
                </div>
              )}

              <div className="stage-topline">
                <span
                  className={cn(
                    "recording-status",
                    isRecording && !isPaused && "recording-status-live",
                    isPaused && "recording-status-paused",
                  )}
                >
                  <span className="recording-status-dot" />
                  {isPaused
                    ? `PAUSED · ${formatTime(elapsed)}`
                    : isRecording
                      ? `RECORDING · ${formatTime(elapsed)}`
                      : streamActive
                        ? "READY WHEN YOU ARE"
                        : "YOUR JOURNAL"}
                </span>
                <span className="stage-mode-label">
                  {mode === "video" ? <Video size={13} /> : <Mic size={13} />}
                  {mode === "video" ? "VIDEO + AUDIO" : "VOICE ONLY"}
                </span>
              </div>

              {mode === "video" && streamActive && (
                <div
                  className="camera-audio-meter"
                  aria-label="Microphone input"
                >
                  <Mic size={13} />
                  <div className="meter-track">
                    <span
                      style={{ width: `${Math.min(100, micLevel * 220)}%` }}
                    />
                  </div>
                  <span>MIC</span>
                </div>
              )}

              <div className="stage-controls">
                <div className="stage-controls-context">
                  <span
                    className={cn(
                      "capture-state-icon",
                      isRecording && !isPaused && "capture-state-active",
                    )}
                  >
                    {mode === "video" ? (
                      <Video size={17} />
                    ) : (
                      <AudioLines size={17} />
                    )}
                  </span>
                  <span>
                    <strong>
                      {isRecording
                        ? isPaused
                          ? "Paused"
                          : "You’re recording"
                        : "Grasp the authentic thoughts"}
                    </strong>
                    <small>
                      {mode === "video" ? "Video and voice" : "Voice only"}
                    </small>
                  </span>
                </div>
                <div className="record-controls">
                  {isRecording ? (
                    <>
                      <Button
                        variant="outline"
                        size="icon"
                        className="stage-icon-button"
                        onClick={isPaused ? resumeRecording : pauseRecording}
                        aria-label={
                          isPaused ? "Resume recording" : "Pause recording"
                        }
                      >
                        {isPaused ? <Play size={16} /> : <Pause size={16} />}
                      </Button>
                      <Button
                        variant="record"
                        size="lg"
                        onClick={stopRecording}
                        className="record-button"
                      >
                        <Square size={14} fill="currentColor" />
                        Finish
                      </Button>
                    </>
                  ) : (
                    <Button
                      variant="record"
                      size="lg"
                      onClick={beginRecording}
                      className="record-button"
                    >
                      <span className="record-button-dot">
                        <Circle size={12} fill="currentColor" />
                      </span>
                      Start a moment
                    </Button>
                  )}
                </div>
              </div>
            </div>

            {error && (
              <p role="alert" className="device-error">
                {error}
              </p>
            )}

            <div className="capture-footer">
              <div
                className="mode-switch"
                role="group"
                aria-label="Recording mode"
              >
                <button
                  type="button"
                  onClick={() => changeMode("video")}
                  aria-pressed={mode === "video"}
                  disabled={isRecording}
                  className={cn(mode === "video" && "mode-active")}
                >
                  <Video size={14} /> Video
                </button>
                <button
                  type="button"
                  onClick={() => changeMode("voice")}
                  aria-pressed={mode === "voice"}
                  disabled={isRecording}
                  className={cn(mode === "voice" && "mode-active")}
                >
                  <Mic size={14} /> Voice
                </button>
              </div>
              <span className="local-note">
                <Radio size={13} /> Saved only in this session
              </span>
            </div>
          </section>

          <section className="transcript-panel" aria-label="Journal transcript">
            <div className="transcript-header">
              <div>
                <div className="transcript-heading-line">
                  <h2>Your words</h2>
                  {(isRecording ||
                    transcript ||
                    interimTranscript ||
                    transcriptionStatus === "transcribing") && (
                    <span className="live-indicator">
                      <span />
                      {isRecording
                        ? feedbackMode === "real-time"
                          ? "LIVE"
                          : "RECORDING"
                        : transcriptionStatus === "transcribing"
                          ? "TRANSCRIBING"
                          : "SAVED"}
                    </span>
                  )}
                </div>
                <p>
                  {isRecording
                    ? feedbackMode === "real-time"
                      ? "Your words and feedback appear as you speak."
                      : "We’ll transcribe your recording when you finish."
                    : "A gentle reflection, whenever you want one."}
                </p>
              </div>
              <span className="language-tag">{language.name}</span>
            </div>

            <div
              className="transcript-content" tabIndex={0} role="region" aria-label="Transcript and feedback"
              aria-live="polite"
              aria-atomic="false"
            >
              {transcript || interimTranscript ? (
                <div className="spoken-transcript">
                  {transcript && <p>{transcript}</p>}
                  {interimTranscript && (
                    <p className="interim-copy">{interimTranscript}</p>
                  )}
                  {isRecording &&
                    feedbackMode === "real-time" &&
                    !transcriptionError && (
                      <span
                        className="listening-cursor"
                        aria-label="Listening"
                      />
                    )}
                  {!isRecording && transcript && (
                    <p className="transcript-next-step">
                      {transcriptionStatus === "transcribing"
                        ? "Perceptron is preparing your final transcript."
                        : "Your words are saved with this take."}
                    </p>
                  )}
                  {transcript && (
                    <section
                      className="grammar-feedback"
                      aria-live="polite"
                      aria-label="Grammar feedback"
                    >
                      {grammarStatus === "checking" && (
                        <p className="grammar-feedback-status">
                          <span
                            className="grammar-feedback-spinner"
                            aria-hidden
                          />
                          Checking your words…
                        </p>
                      )}
                      {grammarStatus === "error" && grammarError && (
                        <div className="grammar-feedback-error" role="status">
                          <span>{grammarError}</span>
                          <button
                            type="button"
                            onClick={() =>
                              setGrammarRetry((attempt) => attempt + 1)
                            }
                          >
                            Try again
                          </button>
                        </div>
                      )}
                      {grammarStatus === "complete" &&
                        grammarResultText === transcript &&
                        (grammarCorrections.length > 0 ? (
                          <ul className="grammar-correction-list">
                            {grammarCorrections.map((item, index) => {
                              const diff = diffGrammarCorrection(
                                item.original,
                                item.correction,
                                language.locale,
                              );
                              return (
                                <li key={`${item.original}-${index}`}>
                                  <p className="feedback-correction">
                                    <span className="grammar-correction-original">
                                      {diff.original.map(
                                        (token, tokenIndex) => (
                                          <span
                                            key={`${tokenIndex}-${token.word}`}
                                          >
                                            {token.prefix}
                                            <span
                                              className={
                                                token.change === "deleted"
                                                  ? "grammar-word-deleted"
                                                  : undefined
                                              }
                                            >
                                              {token.word}
                                            </span>
                                          </span>
                                        ),
                                      )}
                                      {diff.originalSuffix}
                                    </span>
                                    <span aria-hidden>→</span>
                                    <span className="grammar-correction-suggestion">
                                      {diff.correction.map(
                                        (token, tokenIndex) => (
                                          <span
                                            key={`${tokenIndex}-${token.word}`}
                                          >
                                            {token.prefix}
                                            <span
                                              className={
                                                token.change === "added"
                                                  ? "grammar-word-added"
                                                  : undefined
                                              }
                                            >
                                              {token.word}
                                            </span>
                                          </span>
                                        ),
                                      )}
                                      {diff.correctionSuffix}
                                    </span>
                                  </p>
                                  <p>{item.explanation}</p>
                                </li>
                              );
                            })}
                          </ul>
                        ) : (
                          <p className="grammar-feedback-status">
                            No grammar changes suggested. Your words are yours.
                          </p>
                        ))}
                    </section>
                  )}
                </div>
              ) : showDemo && !isRecording ? (
                <div className="demo-transcript">
                  <span className="demo-label">
                    A LITTLE PREVIEW <span>·</span> SAMPLE TEXT
                  </span>
                  <p className="demo-line">We’ve been walking for hours.</p>
                  <p className="demo-line">I’m tired, but I’m glad we came.</p>
                  <p className="demo-line">
                    I made it up here — look at that view.
                  </p>
                  <p className="demo-line">
                    This is a beautiful{" "}
                    {canShowFeedback ? (
                      <button
                        type="button"
                        className="feedback-word feedback-word-error"
                        aria-expanded={feedbackOpen === "correction"}
                        onClick={() =>
                          setFeedbackOpen((open) =>
                            open === "correction" ? null : "correction",
                          )
                        }
                      >
                        scenes
                      </button>
                    ) : (
                      "scene"
                    )}
                    .
                  </p>
                  {canShowFeedback && (
                    <p className="demo-line">
                      I{" "}
                      <button
                        type="button"
                        className="feedback-word feedback-word-positive"
                        aria-expanded={feedbackOpen === "positive"}
                        onClick={() =>
                          setFeedbackOpen((open) =>
                            open === "positive" ? null : "positive",
                          )
                        }
                      >
                        made it up here
                      </button>{" "}
                      — look at that view.
                    </p>
                  )}
                  {feedbackOpen && canShowFeedback && (
                    <aside
                      className="feedback-popover"
                      aria-label="Language feedback"
                    >
                      <div className="feedback-popover-heading">
                        <span className="feedback-symbol">
                          {feedbackOpen === "positive" ? (
                            <Check size={12} />
                          ) : (
                            "↗"
                          )}
                        </span>
                        <span>
                          {feedbackOpen === "positive"
                            ? "A lovely, natural expression"
                            : "Small thought, for later"}
                        </span>
                        <button
                          type="button"
                          onClick={() => setFeedbackOpen(null)}
                          aria-label="Close feedback"
                        >
                          ×
                        </button>
                      </div>
                      {feedbackOpen === "positive" ? (
                        <>
                          <p>
                            “Made it up here” is a natural, conversational way
                            to share that you reached the top.
                          </p>
                          <p className="feedback-tip">
                            It keeps the feeling of the moment in your own
                            words.
                          </p>
                        </>
                      ) : (
                        <>
                          <p className="feedback-correction">
                            <span className="grammar-word-deleted">
                              {DEMO_FEEDBACK.original}
                            </span>
                            <span aria-hidden>→</span>
                            <strong className="grammar-word-added">
                              {DEMO_FEEDBACK.correction}
                            </strong>
                          </p>
                          <p>{DEMO_FEEDBACK.explanation}</p>
                          <p className="feedback-tip">{DEMO_FEEDBACK.tip}</p>
                        </>
                      )}
                      <span className="demo-disclaimer">
                        Example feedback · not generated by AI
                      </span>
                    </aside>
                  )}
                  <p className="demo-hint">
                    <Check size={13} />
                    {canShowFeedback
                      ? "Tap the highlighted word to explore"
                      : "Feedback is quiet for this session"}
                  </p>
                </div>
              ) : (
                <div className="empty-transcript">
                  <span>
                    {transcriptionStatus === "transcribing" ? (
                      <span className="grammar-feedback-spinner" aria-hidden />
                    ) : (
                      <Waves size={20} />
                    )}
                  </span>
                  <p>
                    {transcriptionStatus === "transcribing"
                      ? "Perceptron is transcribing your recording."
                      : isRecording
                        ? feedbackMode === "real-time"
                          ? "Browser speech recognition will show your words as you speak."
                          : "Your recording will be transcribed when you finish."
                        : "When you’re ready, your words will find their way here."}
                  </p>
                  {!isRecording && (
                    <button type="button" onClick={() => setShowDemo(true)}>
                      See a short example
                    </button>
                  )}
                </div>
              )}
            <SceneFeedbackPanel
                recording={recordings[0]}
                mode={mode}
                feedbackMode={feedbackMode}
                isRecording={isRecording}
                isPaused={isPaused}
                videoRef={videoRef}
                liveTranscript={[transcript, interimTranscript].filter(Boolean).join(" ")}
                transcriptionStatus={transcriptionStatus}
                language={isRecording ? language.name : recordings[0]?.language ?? language.name}
              />
            </div>

            {transcriptionError && (
              <div role="status" className="speech-notice">
                <CircleHelp size={14} />
                <span>{transcriptionError}</span>
                {feedbackMode === "after-stop" && (
                  <button
                    type="button"
                    onClick={() =>
                      setTranscriptionRetry((attempt) => attempt + 1)
                    }
                  >
                    Try again
                  </button>
                )}
              </div>
            )}

            <div className="feedback-control">
              <div className="feedback-control-heading">
                <span>Language feedback</span>
                <span className="feedback-level-label">
                  {feedbackMode === "after-stop"
                    ? "After recording"
                    : "Real-time"}
                </span>
              </div>
              <div
                className="feedback-mode-toggle"
                role="group"
                aria-label="Language feedback timing"
              >
                <button
                  type="button"
                  aria-pressed={feedbackMode === "after-stop"}
                  disabled={isRecording}
                  className={cn(
                    feedbackMode === "after-stop" && "feedback-mode-active",
                  )}
                  onClick={() => {
                    setFeedbackMode("after-stop");
                    setFeedbackOpen(null);
                  }}
                >
                  After recording
                  <small>{mode === "video" ? "Full-video analysis" : "Audio transcription"}</small>
                </button>
                <button
                  type="button"
                  aria-pressed={feedbackMode === "real-time"}
                  disabled={isRecording}
                  className={cn(
                    feedbackMode === "real-time" && "feedback-mode-active",
                  )}
                  onClick={() => {
                    setFeedbackMode("real-time");
                    setFeedbackOpen(null);
                  }}
                >
                  Real-time
                  <small>{mode === "video" ? "Images every 0.5s" : "Browser transcription"}</small>
                </button>
              </div>
              <p className="feedback-description">
                {feedbackMode === "after-stop"
                  ? mode === "video"
                    ? "After you stop, your complete video and transcript are sent to Perceptron for scene-based language feedback."
                    : "Perceptron transcribes your audio and checks your grammar after recording."
                  : mode === "video"
                    ? "Camera images are captured every 0.5 seconds and sent in recent batches. Browser transcription supplies your words."
                    : "Browser speech recognition transcribes live; grammar suggestions follow each spoken phrase."}
              </p>
              <p className="feedback-privacy-note">
                {mode === "video"
                  ? feedbackMode === "after-stop"
                    ? "The full video is uploaded for analysis (up to 20 MiB). Audio is also sent for transcription. Nothing is written to MongoDB by this feature."
                    : "Camera images and recognized speech are sent while recording. When analysis is slower, only recent frames are retained; results are not instantaneous."
                  : feedbackMode === "after-stop"
                    ? "Your audio is sent for transcription; recognized text is sent for grammar feedback."
                    : "Live transcription uses your browser; recognized text is sent for grammar feedback."}
              </p>
            </div>

            <div className="transcript-footer">
              <div className="mini-waveform" aria-label="Audio level waveform">
                {bars.slice(0, 26).map((height, index) => (
                  <span
                    key={index}
                    className={cn(
                      streamActive ? "mini-wave-live" : "mini-wave-idle",
                    )}
                    style={{ height: `${Math.max(3, height * 20)}px` }}
                  />
                ))}
              </div>
              <div className="audio-meta">
                <strong>
                  {isRecording
                    ? isPaused
                      ? "Paused"
                      : "A moment in progress"
                    : transcriptionStatus === "transcribing"
                      ? "Transcribing your moment"
                      : transcript
                        ? "Your journal entry"
                        : "Ready when you are"}
                </strong>
                <span>
                  {isRecording
                    ? formatTime(elapsed)
                    : "Your recording stays in this session"}
                </span>
              </div>
              <span className="audio-icon">
                <AudioLines size={16} />
              </span>
            </div>
          </section>
        </div>

        <section
          className="journal-entries"
          aria-label="Recent journal entries"
        >
          <div className="entries-heading">
            <div>
              <p className="eyebrow">KEPT CLOSE</p>
              <h2>
                Recent moments{" "}
                <span>{recordings.length.toString().padStart(2, "0")}</span>
              </h2>
            </div>
            {recordings.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="clear-recordings"
                onClick={clearRecordings}
              >
                Clear entries
              </Button>
            )}
          </div>
          {recordings.length === 0 ? (
            <div className="entries-empty">
              <span>
                <AudioWaveform size={17} />
              </span>
              <p>
                Your first moment will stay here until you leave this session.
              </p>
            </div>
          ) : (
            <div className="entries-grid">
              {recordings.map((recording, index) => (
                <article key={recording.id} className="entry-card">
                  <div className="entry-card-top">
                    <span className="entry-index">
                      {String(recordings.length - index).padStart(2, "0")}
                    </span>
                    <span className="entry-mode">
                      {recording.mode === "video" ? (
                        <Video size={12} />
                      ) : (
                        <Mic size={12} />
                      )}
                      {recording.mode === "video"
                        ? "Video journal"
                        : "Voice journal"}
                    </span>
                    <span className="entry-duration">
                      {formatTime(recording.duration)}
                    </span>
                  </div>
                  {recording.mode === "video" ? (
                    <video
                      src={recording.url}
                      controls
                      playsInline
                      className="entry-media"
                      aria-label="Play video journal entry"
                    />
                  ) : (
                    <div className="entry-audio">
                      <AudioLines size={17} />
                      <audio
                        src={recording.url}
                        controls
                        aria-label="Play voice journal entry"
                      />
                    </div>
                  )}
                  <p
                    className={cn(
                      "entry-transcript",
                      expandedRecordingId !== recording.id &&
                        "entry-transcript-clamped",
                    )}
                  >
                    {recording.transcript ||
                      "No speech transcript was captured for this moment."}
                  </p>
                  {recording.transcript && (
                    <button
                      type="button"
                      className="entry-transcript-toggle"
                      aria-expanded={expandedRecordingId === recording.id}
                      onClick={() =>
                        setExpandedRecordingId((id) =>
                          id === recording.id ? null : recording.id,
                        )
                      }
                    >
                      {expandedRecordingId === recording.id
                        ? "Show less"
                        : "Read full transcript"}
                    </button>
                  )}
                  <div className="entry-card-bottom">
                    <span>
                      {recording.language || language.name} <span>·</span>{" "}
                      {recording.createdAt.toLocaleTimeString([], {
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </span>
                    <div>
                      <a
                        href={recording.url}
                        download={`lived-${recording.id}.webm`}
                        aria-label="Download journal entry"
                      >
                        <Download size={14} />
                      </a>
                      <button
                        type="button"
                        onClick={() => deleteRecording(recording.id)}
                        aria-label="Delete journal entry"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        <footer className="studio-note">
          <RotateCcw size={13} />
          <span>
            Recordings are kept locally for this session. The selected feedback mode sends audio, video, camera images or recognized text to Perceptron for analysis. Point the camera at what you want to describe.
          </span>
        </footer>
      </main>
    </div>
  );
}
