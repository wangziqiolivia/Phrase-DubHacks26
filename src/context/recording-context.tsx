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
  startRecording: () => void;
  stopRecording: () => void;
  pauseRecording: () => void;
  resumeRecording: () => void;
  deleteRecording: (id: string) => void;
  clearRecordings: () => void;
  startPreview: (nextMode?: Mode) => Promise<void>;
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
      } catch {
        setError(
          "Could not access your camera or microphone. Check browser permissions and make sure no other app is using them."
        );
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

  const startRecording = () => {
    if (!streamRef.current) {
      void startPreview(mode);
      return;
    }
    setError(null);
    chunksRef.current = [];
    const mime = MediaRecorder.isTypeSupported("video/webm;codecs=vp9")
      ? "video/webm;codecs=vp9"
      : undefined;
    const rec = new MediaRecorder(
      streamRef.current,
      mime ? { mimeType: mime } : undefined
    );
    recorderRef.current = rec;
    rec.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };
    rec.onstop = () => {
      const type = mode === "video" ? "video/webm" : "audio/webm";
      const blob = new Blob(chunksRef.current, { type });
      const url = URL.createObjectURL(blob);
      setRecordings((prev) => [
        {
          id: crypto.randomUUID(),
          url,
          blob,
          mode,
          duration: Math.floor((Date.now() - startTimeRef.current) / 1000),
          createdAt: new Date(),
        },
        ...prev,
      ]);
    };
    startTimeRef.current = Date.now();
    elapsedBaseRef.current = 0;
    rec.start(250);
    setIsRecording(true);
    setIsPaused(false);
    setElapsed(0);
    startTimer();
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

  const clearRecordings = () => setRecordings([]);

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
        startPreview,
      }}
    >
      {children}
    </RecordingContext.Provider>
  );
}
