"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

export type Mode = "video" | "voice";

export interface Recording {
  id: string;
  url: string;
  blob: Blob;
  mode: Mode;
  duration: number;
  createdAt: Date;
  transcript?: string;
  language?: string;
}

interface RecordingContextValue {
  mode: Mode;
  setMode: (mode: Mode) => void;
  isRecording: boolean;
  isPaused: boolean;
  elapsed: number;
  error: string | null;
  recordings: Recording[];
  streamActive: boolean;
  micLevel: number;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  startRecording: () => Promise<void>;
  stopRecording: () => void;
  pauseRecording: () => void;
  resumeRecording: () => void;
  deleteRecording: (id: string) => void;
  clearRecordings: () => void;
  updateRecordingTranscript: (id: string, transcript: string, language: string) => void;
  startPreview: (nextMode?: Mode) => Promise<void>;
  stopPreview: () => void;
}

const RecordingContext = createContext<RecordingContextValue | null>(null);

export function useRecording() {
  const ctx = useContext(RecordingContext);
  if (!ctx) throw new Error("useRecording must be used within RecordingProvider");
  return ctx;
}

export function RecordingProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<Mode>("video");
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [micLevel, setMicLevel] = useState(0);
  const [streamActive, setStreamActive] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const rafRef = useRef<number | null>(null);
  const startTimeRef = useRef(0);
  const elapsedBaseRef = useRef(0);

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setStreamActive(false);
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    audioCtxRef.current?.close().catch(() => {});
    audioCtxRef.current = null;
    analyserRef.current = null;
    setMicLevel(0);
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  const startPreview = useCallback(
    async (nextMode: Mode = mode) => {
      setError(null);
      if (isRecording) return;
      stopStream();
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          setError("This browser does not support camera or microphone access.");
          return;
        }
        const stream = await navigator.mediaDevices.getUserMedia({
          video:
            nextMode === "video"
              ? { width: { ideal: 1280 }, height: { ideal: 720 } }
              : false,
          audio: true,
        });
        streamRef.current = stream;
        if (nextMode === "video" && videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }
        setStreamActive(true);

        const ctx = new AudioContext();
        audioCtxRef.current = ctx;
        const src = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        src.connect(analyser);
        analyserRef.current = analyser;

        const data = new Uint8Array(analyser.frequencyBinCount);
        const tick = () => {
          analyser.getByteFrequencyData(data);
          const avg = data.reduce((a, b) => a + b, 0) / data.length / 255;
          setMicLevel(avg);
          rafRef.current = requestAnimationFrame(tick);
        };
        tick();
      } catch (cause) {
        const message =
          cause instanceof DOMException && cause.name === "NotAllowedError"
            ? "Camera or microphone access was denied. Allow access in your browser settings, then try again."
            : cause instanceof DOMException && cause.name === "NotFoundError"
              ? "No compatible camera or microphone was found for this recording mode."
              : "Could not access your camera or microphone. Check browser permissions and that no other app is using them.";
        setError(message);
      }
    },
    [isRecording, mode, stopStream]
  );

  const clearTimer = () => {
    if (timerRef.current) window.clearInterval(timerRef.current);
    timerRef.current = null;
  };

  const startTimer = () => {
    clearTimer();
    timerRef.current = window.setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000));
    }, 500);
  };

  const startRecording = async () => {
    if (!streamRef.current) {
      await startPreview(mode);
    }
    const stream = streamRef.current;
    if (!stream) return;
    if (typeof MediaRecorder === "undefined") {
      setError("Recording is not supported by this browser.");
      return;
    }
    setError(null);
    chunksRef.current = [];
    const requestedMode = mode;
    const preferredMimes =
      requestedMode === "video"
        ? ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"]
        : ["audio/webm;codecs=opus", "audio/webm"];
    const mime = preferredMimes.find((candidate) =>
      MediaRecorder.isTypeSupported(candidate)
    );
    let rec: MediaRecorder;
    try {
      rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
    } catch {
      setError("This browser could not start a recording with the selected device.");
      return;
    }
    recorderRef.current = rec;
    rec.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };
    rec.onstop = () => {
      const type = rec.mimeType || (requestedMode === "video" ? "video/webm" : "audio/webm");
      const blob = new Blob(chunksRef.current, { type });
      const url = URL.createObjectURL(blob);
      setRecordings((prev) => [
        {
          id: crypto.randomUUID(),
          url,
          blob,
          mode: requestedMode,
          duration: Math.floor((Date.now() - startTimeRef.current) / 1000),
          createdAt: new Date(),
        },
        ...prev,
      ]);
    };
    rec.onerror = () => {
      setError("The browser encountered an error while recording. Try starting a new moment.");
      setIsRecording(false);
      setIsPaused(false);
      clearTimer();
    };
    startTimeRef.current = Date.now();
    elapsedBaseRef.current = 0;
    try {
      rec.start(250);
      setIsRecording(true);
      setIsPaused(false);
      setElapsed(0);
      startTimer();
    } catch {
      recorderRef.current = null;
      setError("The browser could not begin recording. Check the selected device and try again.");
    }
  };

  const stopRecording = () => {
    recorderRef.current?.stop();
    recorderRef.current = null;
    setIsRecording(false);
    setIsPaused(false);
    clearTimer();
  };

  const pauseRecording = () => {
    if (!isRecording || isPaused) return;
    const rec = recorderRef.current;
    if (rec && rec.state === "recording" && typeof rec.pause === "function") {
      rec.pause();
    }
    elapsedBaseRef.current = Math.floor((Date.now() - startTimeRef.current) / 1000);
    setElapsed(elapsedBaseRef.current);
    startTimeRef.current = Date.now() - elapsedBaseRef.current * 1000;
    clearTimer();
    setIsPaused(true);
  };

  const resumeRecording = () => {
    if (!isRecording || !isPaused) return;
    const rec = recorderRef.current;
    if (rec && rec.state === "paused" && typeof rec.resume === "function") {
      rec.resume();
    }
    startTimeRef.current = Date.now() - elapsedBaseRef.current * 1000;
    startTimer();
    setIsPaused(false);
  };

  const deleteRecording = (id: string) => {
    setRecordings((prev) => {
      const target = prev.find((r) => r.id === id);
      if (target) URL.revokeObjectURL(target.url);
      return prev.filter((r) => r.id !== id);
    });
  };

  const clearRecordings = () => {
    recordings.forEach((recording) => URL.revokeObjectURL(recording.url));
    setRecordings([]);
  };

  const updateRecordingTranscript = useCallback(
    (id: string, transcript: string, language: string) => {
      setRecordings((prev) =>
        prev.map((recording) =>
          recording.id === id
            ? { ...recording, transcript, language }
            : recording
        )
      );
    },
    []
  );

  useEffect(() => {
    return () => {
      clearTimer();
      stopStream();
    };
  }, [stopStream]);

  return (
    <RecordingContext.Provider
      value={{
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
        updateRecordingTranscript,
        startPreview,
        stopPreview: stopStream,
      }}
    >
      {children}
    </RecordingContext.Provider>
  );
}
