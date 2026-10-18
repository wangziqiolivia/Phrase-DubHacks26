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
import { Slider } from "@/components/ui/slider";
import { useRecording, type Mode } from "@/context/recording-context";
import { cn, formatTime } from "@/lib/utils";

const LANGUAGES = [
  { name: "English", locale: "en-US" },
  { name: "Spanish", locale: "es-ES" },
  { name: "French", locale: "fr-FR" },
  { name: "Japanese", locale: "ja-JP" },
];

const DEMO_FEEDBACK = {
  original: "scenes",
  correction: "scene",
  explanation: "Because you used “a,” the noun should be singular here.",
  tip: "“This is a beautiful view” sounds natural in this moment, too.",
};

export function RecorderStudio() {
  const {
    mode,
    setMode,
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
  const [language, setLanguage] = useState(LANGUAGES[0]);
  const [feedbackLevel, setFeedbackLevel] = useState([1]);
  const [transcript, setTranscript] = useState("");
  const [interimTranscript, setInterimTranscript] = useState("");
  const [speechNotice, setSpeechNotice] = useState<string | null>(null);
  const [feedbackOpen, setFeedbackOpen] = useState<"correction" | "positive" | null>(null);
  const [showDemo, setShowDemo] = useState(true);
  const [expandedRecordingId, setExpandedRecordingId] = useState<string | null>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const recognitionActiveRef = useRef(false);
  const transcriptRef = useRef("");
  const wasRecordingRef = useRef(false);
  const lastSavedRecordingRef = useRef<string | null>(null);

  useEffect(() => {
    if (isRecording && !wasRecordingRef.current) {
      transcriptRef.current = "";
      setTranscript("");
      setInterimTranscript("");
      setSpeechNotice(null);
      setFeedbackOpen(null);
      setShowDemo(false);
    }
    wasRecordingRef.current = isRecording;
  }, [isRecording]);

  useEffect(() => {
    if (!isRecording || isPaused) {
      recognitionActiveRef.current = false;
      recognitionRef.current?.stop();
      recognitionRef.current = null;
      setInterimTranscript("");
      return;
    }

    const Recognition =
      window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!Recognition) {
      setSpeechNotice(
        "Live transcription isn't supported by this browser. Your recording will still be saved."
      );
      return;
    }

    const recognition = new Recognition();
    recognitionRef.current = recognition;
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = language.locale;
    recognitionActiveRef.current = true;

    recognition.onresult = (event) => {
      let finalized = "";
      let interim = "";
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
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
      }
      setInterimTranscript(interim.trim());
    };

    recognition.onerror = (event) => {
      const speechEvent = event as SpeechRecognitionErrorEvent;
      if (speechEvent.error === "not-allowed" || speechEvent.error === "service-not-allowed") {
        recognitionActiveRef.current = false;
        setSpeechNotice(
          "Microphone access for speech recognition was denied. Recording continues without a transcript."
        );
      } else if (speechEvent.error !== "no-speech" && speechEvent.error !== "aborted") {
        setSpeechNotice(
          "Speech recognition stopped unexpectedly. Your recording continues; try again in a supported browser."
        );
      }
    };

    recognition.onend = () => {
      if (!recognitionActiveRef.current) return;
      window.setTimeout(() => {
        if (!recognitionActiveRef.current) return;
        try {
          recognition.start();
        } catch {
          recognitionActiveRef.current = false;
          setSpeechNotice(
            "Speech recognition couldn't restart. Your recording continues without it."
          );
        }
      }, 200);
    };

    try {
      recognition.start();
      setSpeechNotice(null);
    } catch {
      recognitionActiveRef.current = false;
      setSpeechNotice(
        "Speech recognition couldn't start. Your recording will continue without a transcript."
      );
    }

    return () => {
      recognitionActiveRef.current = false;
      recognition.stop();
      recognitionRef.current = null;
    };
  }, [isRecording, isPaused, language.locale]);

  useEffect(() => {
    const latest = recordings[0];
    if (!latest || latest.id === lastSavedRecordingRef.current || isRecording) return;
    lastSavedRecordingRef.current = latest.id;
    updateRecordingTranscript(latest.id, transcriptRef.current, language.name);
  }, [recordings, isRecording, language.name, updateRecordingTranscript]);

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
  const canShowFeedback = feedbackLevel[0] > 0 && (!isRecording || feedbackLevel[0] === 2);

  return (
    <div className="journal-shell min-h-screen text-white">
      <header className="journal-header">
        <Link href="/" aria-label="Lived home" className="brand-lockup">
          <span className="brand-mark"><AudioWaveform aria-hidden /></span>
          <span>
            <span className="brand-name">Phrase</span>
            <span className="brand-caption">Learn a new language in a natural way.</span>
          </span>
        </Link>

        <div className="header-actions">
          <span className="header-note"><span className="status-dot" /> Your space, your pace</span>
          <Link href="/assistant" className="help-link">
            <CircleHelp size={16} aria-hidden />
            <span>How it works</span>
          </Link>
        </div>
      </header>

      <main className="studio-main">
        <section className="studio-intro">
          <div>
            <p className="eyebrow">Learn in practice.</p>
            <h1>Learn a new language effortlessly.</h1>
            <p className="intro-copy">No boring textbooks. Specially made for beginners.</p>
          </div>
          <label className="language-picker">
            <span>Practicing</span>
            <span className="select-wrap">
              <select
                value={language.name}
                onChange={(event) => {
                  const next = LANGUAGES.find((item) => item.name === event.target.value);
                  if (next) setLanguage(next);
                }}
                disabled={isRecording}
                aria-label="Language to practice"
              >
                {LANGUAGES.map((item) => <option key={item.name}>{item.name}</option>)}
              </select>
              <ChevronDown size={14} aria-hidden />
            </span>
          </label>
        </section>

        <div className="studio-layout">
          <section className="capture-panel" aria-label="Recording studio">
            <div className={cn("capture-stage", mode === "voice" && "voice-stage")}>
              {mode === "video" ? (
                <>
                  <video
                    ref={videoRef}
                    muted
                    playsInline
                    className={cn("camera-feed", !streamActive && "camera-feed-hidden")}
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
                        <span className="welcome-icon"><Video size={18} /></span>
                        <p className="stage-overline">Daily life | self-reflections</p>
                        <h2>Record anything you want to say.</h2>
                        <p>Turn on your camera when you’re ready. Nothing starts until you are.</p>
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
                  <div className={cn("voice-orbit", isRecording && !isPaused && "voice-orbit-active")}>
                    <span className="orbit-ring ring-one" />
                    <span className="orbit-ring ring-two" />
                    <span className="voice-center"><Mic size={25} /></span>
                  </div>
                  <div className="voice-waveform" aria-label={streamActive ? "Microphone input level" : "Microphone not active"}>
                    {bars.map((height, index) => (
                      <span
                        key={index}
                        className={cn(streamActive ? "wave-bar-live" : "wave-bar-idle")}
                        style={{ height: `${Math.max(6, height * 58)}px` }}
                      />
                    ))}
                  </div>
                  <p className="voice-stage-caption">
                    {isPaused ? "A quiet pause" : isRecording ? "Listening to your story" : "A voice note, whenever you’re ready"}
                  </p>
                  {!streamActive && !isRecording && (
                    <button type="button" className="voice-enable" onClick={() => void startPreview("voice")}>
                      <Headphones size={15} />
                      Check microphone
                    </button>
                  )}
                </div>
              )}

              <div className="stage-topline">
                <span className={cn("recording-status", isRecording && !isPaused && "recording-status-live", isPaused && "recording-status-paused")}>
                  <span className="recording-status-dot" />
                  {isPaused ? `PAUSED · ${formatTime(elapsed)}` : isRecording ? `RECORDING · ${formatTime(elapsed)}` : streamActive ? "READY WHEN YOU ARE" : "YOUR JOURNAL"}
                </span>
                <span className="stage-mode-label">
                  {mode === "video" ? <Video size={13} /> : <Mic size={13} />}
                  {mode === "video" ? "VIDEO + AUDIO" : "VOICE ONLY"}
                </span>
              </div>

              {mode === "video" && streamActive && (
                <div className="camera-audio-meter" aria-label="Microphone input">
                  <Mic size={13} />
                  <div className="meter-track"><span style={{ width: `${Math.min(100, micLevel * 220)}%` }} /></div>
                  <span>MIC</span>
                </div>
              )}

              <div className="stage-controls">
                <div className="stage-controls-context">
                  <span className={cn("capture-state-icon", isRecording && !isPaused && "capture-state-active")}>
                    {mode === "video" ? <Video size={17} /> : <AudioLines size={17} />}
                  </span>
                  <span>
                    <strong>{isRecording ? (isPaused ? "Paused" : "You’re recording") : "A moment worth keeping"}</strong>
                    <small>{mode === "video" ? "Video and your voice, together" : "Just your voice, nothing else"}</small>
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
                        aria-label={isPaused ? "Resume recording" : "Pause recording"}
                      >
                        {isPaused ? <Play size={16} /> : <Pause size={16} />}
                      </Button>
                      <Button variant="record" size="lg" onClick={stopRecording} className="record-button">
                        <Square size={14} fill="currentColor" />
                        Finish
                      </Button>
                    </>
                  ) : (
                    <Button variant="record" size="lg" onClick={beginRecording} className="record-button">
                      <span className="record-button-dot"><Circle size={12} fill="currentColor" /></span>
                      Start a moment
                    </Button>
                  )}
                </div>
              </div>
            </div>

            {error && <p role="alert" className="device-error">{error}</p>}

            <div className="capture-footer">
              <div className="mode-switch" role="group" aria-label="Recording mode">
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
              <span className="local-note"><Radio size={13} /> Saved only in this session</span>
            </div>
          </section>

          <section className="transcript-panel" aria-label="Journal transcript">
            <div className="transcript-header">
              <div>
                <div className="transcript-heading-line">
                  <h2>Your words</h2>
                  {(isRecording || transcript) && <span className="live-indicator"><span />{isRecording ? "LIVE" : "SAVED"}</span>}
                </div>
                <p>{isRecording ? "No rush. We’re right here with you." : "A gentle reflection, whenever you want one."}</p>
              </div>
              <span className="language-tag">{language.name}</span>
            </div>

            <div className="transcript-content" aria-live="polite" aria-atomic="false">
              {transcript || interimTranscript ? (
                <div className="spoken-transcript">
                  {transcript && <p>{transcript}</p>}
                  {interimTranscript && <p className="interim-copy">{interimTranscript}</p>}
                  {isRecording && !speechNotice && <span className="listening-cursor" aria-label="Listening" />}
                  {!isRecording && transcript && (
                    <p className="transcript-next-step">
                      {feedbackLevel[0] === 0
                        ? "You chose a quiet session. Your words are yours to revisit."
                        : "Your words are saved with this take. Contextual AI feedback isn’t connected yet."}
                    </p>
                  )}
                </div>
              ) : showDemo && !isRecording ? (
                <div className="demo-transcript">
                  <span className="demo-label">A LITTLE PREVIEW <span>·</span> SAMPLE TEXT</span>
                  <p className="demo-line">We’ve been walking for hours.</p>
                  <p className="demo-line">I’m tired, but I’m glad we came.</p>
                  <p className="demo-line">I made it up here — look at that view.</p>
                  <p className="demo-line">
                    This is a beautiful{" "}
                    {canShowFeedback ? (
                      <button
                        type="button"
                        className="feedback-word feedback-word-error"
                        aria-expanded={feedbackOpen === "correction"}
                        onClick={() => setFeedbackOpen((open) => open === "correction" ? null : "correction")}
                      >
                        scenes
                      </button>
                    ) : "scene"}.
                  </p>
                  {canShowFeedback && (
                    <p className="demo-line">
                    I{" "}
                    <button
                      type="button"
                      className="feedback-word feedback-word-positive"
                      aria-expanded={feedbackOpen === "positive"}
                      onClick={() => setFeedbackOpen((open) => open === "positive" ? null : "positive")}
                    >
                      made it up here
                    </button>{" "}
                    — look at that view.
                    </p>
                  )}
                  {feedbackOpen && canShowFeedback && (
                    <aside className="feedback-popover" aria-label="Language feedback">
                    <div className="feedback-popover-heading">
                      <span className="feedback-symbol">{feedbackOpen === "positive" ? <Check size={12} /> : "↗"}</span>
                      <span>{feedbackOpen === "positive" ? "A lovely, natural expression" : "Small thought, for later"}</span>
                      <button type="button" onClick={() => setFeedbackOpen(null)} aria-label="Close feedback">×</button>
                    </div>
                    {feedbackOpen === "positive" ? (
                      <>
                        <p>“Made it up here” is a natural, conversational way to share that you reached the top.</p>
                        <p className="feedback-tip">It keeps the feeling of the moment in your own words.</p>
                      </>
                    ) : (
                      <>
                        <p className="feedback-correction">
                          <span>{DEMO_FEEDBACK.original}</span>
                          <span aria-hidden>→</span>
                          <strong>{DEMO_FEEDBACK.correction}</strong>
                        </p>
                        <p>{DEMO_FEEDBACK.explanation}</p>
                        <p className="feedback-tip">{DEMO_FEEDBACK.tip}</p>
                      </>
                    )}
                    <span className="demo-disclaimer">Example feedback · not generated by AI</span>
                    </aside>
                  )}
                  <p className="demo-hint">
                    <Check size={13} />
                    {canShowFeedback ? "Tap the highlighted word to explore" : "Feedback is quiet for this session"}
                  </p>
                </div>
              ) : (
                <div className="empty-transcript">
                  <span><Waves size={20} /></span>
                  <p>{isRecording ? "Your words will settle here as you speak." : "When you’re ready, your words will find their way here."}</p>
                  {!isRecording && <button type="button" onClick={() => setShowDemo(true)}>See a short example</button>}
                </div>
              )}
            </div>

            {speechNotice && (
              <div role="status" className="speech-notice">
                <CircleHelp size={14} />
                <span>{speechNotice}</span>
              </div>
            )}

            <div className="feedback-control">
              <div className="feedback-control-heading">
                <span>Live language feedback</span>
                <span className="feedback-level-label">
                  {["Quiet", "Gentle", "Curious"][feedbackLevel[0]]}
                </span>
              </div>
              <Slider
                value={feedbackLevel}
                onValueChange={(value) => {
                  setFeedbackLevel(value);
                  setFeedbackOpen(null);
                }}
                min={0}
                max={2}
                step={1}
                aria-label="Live language feedback intensity"
                className="feedback-slider"
              />
              <div className="slider-labels"><span>No</span><span>A little</span><span>Yes</span></div>
              <p className="feedback-description">
                {feedbackLevel[0] === 0
                  ? "Just let the story flow. Review later, if you like."
                  : feedbackLevel[0] === 1
                    ? "Keep the moment. We’ll leave the little notes for later."
                    : "Show gentle language notes as you go."}
              </p>
            </div>

            <div className="transcript-footer">
              <div className="mini-waveform" aria-label="Audio level waveform">
                {bars.slice(0, 26).map((height, index) => (
                  <span key={index} className={cn(streamActive ? "mini-wave-live" : "mini-wave-idle")} style={{ height: `${Math.max(3, height * 20)}px` }} />
                ))}
              </div>
              <div className="audio-meta">
                <strong>{isRecording ? (isPaused ? "Paused" : "A moment in progress") : transcript ? "Your journal entry" : "Ready when you are"}</strong>
                <span>{isRecording ? formatTime(elapsed) : "Audio stays on this device"}</span>
              </div>
              <span className="audio-icon"><AudioLines size={16} /></span>
            </div>
          </section>
        </div>

        <section className="journal-entries" aria-label="Recent journal entries">
          <div className="entries-heading">
            <div>
              <p className="eyebrow">KEPT CLOSE</p>
              <h2>Recent moments <span>{recordings.length.toString().padStart(2, "0")}</span></h2>
            </div>
            {recordings.length > 0 && (
              <Button variant="ghost" size="sm" className="clear-recordings" onClick={clearRecordings}>
                Clear entries
              </Button>
            )}
          </div>
          {recordings.length === 0 ? (
            <div className="entries-empty">
              <span><AudioWaveform size={17} /></span>
              <p>Your first moment will stay here until you leave this session.</p>
            </div>
          ) : (
            <div className="entries-grid">
              {recordings.map((recording, index) => (
                <article key={recording.id} className="entry-card">
                  <div className="entry-card-top">
                    <span className="entry-index">{String(recordings.length - index).padStart(2, "0")}</span>
                    <span className="entry-mode">{recording.mode === "video" ? <Video size={12} /> : <Mic size={12} />}{recording.mode === "video" ? "Video journal" : "Voice journal"}</span>
                    <span className="entry-duration">{formatTime(recording.duration)}</span>
                  </div>
                  {recording.mode === "video" ? (
                    <video src={recording.url} controls playsInline className="entry-media" aria-label="Play video journal entry" />
                  ) : (
                    <div className="entry-audio"><AudioLines size={17} /><audio src={recording.url} controls aria-label="Play voice journal entry" /></div>
                  )}
                  <p className={cn("entry-transcript", expandedRecordingId !== recording.id && "entry-transcript-clamped")}>
                    {recording.transcript || "No speech transcript was captured for this moment."}
                  </p>
                  {recording.transcript && (
                    <button
                      type="button"
                      className="entry-transcript-toggle"
                      aria-expanded={expandedRecordingId === recording.id}
                      onClick={() => setExpandedRecordingId((id) => id === recording.id ? null : recording.id)}
                    >
                      {expandedRecordingId === recording.id ? "Show less" : "Read full transcript"}
                    </button>
                  )}
                  <div className="entry-card-bottom">
                    <span>{recording.language || language.name} <span>·</span> {recording.createdAt.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</span>
                    <div>
                      <a href={recording.url} download={`lived-${recording.id}.webm`} aria-label="Download journal entry"><Download size={14} /></a>
                      <button type="button" onClick={() => deleteRecording(recording.id)} aria-label="Delete journal entry"><Trash2 size={14} /></button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        <footer className="studio-note">
          <RotateCcw size={13} />
          <span>Everything here is temporary. Your recordings stay in this browser session and aren’t uploaded.</span>
        </footer>
      </main>
    </div>
  );
}
