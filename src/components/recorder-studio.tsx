"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  Video,
  Mic,
  Circle,
  Square,
  Download,
  Trash2,
  HelpCircle,
  AudioWaveform,
  Eye,
  EyeOff,
  RotateCcw,
  Play,
} from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { useRecording } from "@/context/recording-context";
import { cn, formatTime } from "@/lib/utils";

const DEFAULT_OVERLAY_TEXT =
  "Welcome to your recording session.\nThis floating note stays on top while you record — edit me, drag me around, or tune my transparency with the slider below.";

export function RecorderStudio() {
  const router = useRouter();
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
  } = useRecording();

  const [overlayVisible, setOverlayVisible] = useState(true);
  const [overlayOpacity, setOverlayOpacity] = useState([55]);
  const [overlayText, setOverlayText] = useState(DEFAULT_OVERLAY_TEXT);
  const overlayRef = useRef<HTMLDivElement>(null);
  const dragState = useRef({ dx: 0, dy: 0, dragging: false });
  const [overlayPos, setOverlayPos] = useState({ x: 0, y: 0 });

  useEffect(() => {
    if (!isRecording) void startPreview(mode);
  }, [mode, isRecording, startPreview]);

  const openAssistant = () => {
    if (isRecording && !isPaused) pauseRecording();
    router.push("/assistant");
  };

  const onOverlayPointerDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest("textarea,button")) return;
    dragState.current = {
      dx: e.clientX - overlayPos.x,
      dy: e.clientY - overlayPos.y,
      dragging: true,
    };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onOverlayPointerMove = (e: React.PointerEvent) => {
    if (!dragState.current.dragging) return;
    setOverlayPos({ x: e.clientX - dragState.current.dx, y: e.clientY - dragState.current.dy });
  };
  const onOverlayPointerUp = () => {
    dragState.current.dragging = false;
  };

  const bars = Array.from({ length: 48 }, (_, i) => {
    const wave = Math.abs(Math.sin(i * 0.55)) * 0.4;
    const level = Math.min(1, micLevel * 2.2 + wave * micLevel + 0.06);
    return level;
  });

  const statusLabel = isPaused
    ? `PAUSED ${formatTime(elapsed)}`
    : isRecording
      ? `REC ${formatTime(elapsed)}`
      : mode === "video"
        ? "PREVIEW"
        : "READY";

  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-50 to-zinc-200/60 text-zinc-950">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 pt-6 sm:px-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-zinc-900 text-white shadow">
            <AudioWaveform className="h-5 w-5" />
          </div>
          <div>
            <p className="text-base font-semibold leading-tight tracking-tight">Capture Studio</p>
            <p className="text-xs text-zinc-500">Video & voice recorder</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/review"
            className={cn(buttonVariants({ variant: "secondary", size: "sm" }), "hidden sm:inline-flex")}
          >
            Review transcript
          </Link>
          <Link
            href="/review"
            className={cn(buttonVariants({ variant: "secondary", size: "sm" }), "sm:hidden")}
          >
            Transcript
          </Link>
          <Button
            variant="outline"
            size="icon"
            aria-label="Open help assistant"
            onClick={openAssistant}
          >
            <HelpCircle className="h-5 w-5" />
          </Button>
        </div>
      </header>

      {isPaused && (
        <div className="mx-auto mt-4 max-w-6xl px-4 sm:px-6">
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
            Recording is paused at {formatTime(elapsed)}.{" "}
            <button
              type="button"
              onClick={resumeRecording}
              className="cursor-pointer font-semibold underline underline-offset-2"
            >
              Resume
            </button>{" "}
            or open{" "}
            <button
              type="button"
              onClick={openAssistant}
              className="cursor-pointer font-semibold underline underline-offset-2"
            >
              Help assistant
            </button>
            .
          </div>
        </div>
      )}

      <main className="mx-auto w-full max-w-6xl px-4 pb-16 pt-6 sm:px-6">
        <div className="flex flex-col items-center gap-3">
          <div
            role="tablist"
            aria-label="Recording mode"
            className="grid w-full max-w-sm grid-cols-2 gap-1 rounded-2xl border border-zinc-200 bg-white p-1 shadow-sm"
          >
            {(
              [
                { id: "video" as const, label: "Video", icon: Video },
                { id: "voice" as const, label: "Voice", icon: Mic },
              ] as const
            ).map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                role="tab"
                aria-selected={mode === id}
                disabled={isRecording}
                onClick={() => setMode(id)}
                className={cn(
                  "flex h-10 cursor-pointer items-center justify-center gap-2 rounded-xl text-sm font-medium transition-all disabled:cursor-not-allowed disabled:opacity-50",
                  mode === id
                    ? "bg-zinc-900 text-white shadow"
                    : "text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900"
                )}
              >
                <Icon className="h-4 w-4" />
                {label}
              </button>
            ))}
          </div>
          <p className="text-xs text-zinc-500">
            {mode === "video" ? "Camera + microphone" : "Microphone only"} · stored locally
          </p>
        </div>

        {error && (
          <div className="mx-auto mt-4 max-w-2xl rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <Card className="relative mt-6 overflow-hidden">
          <div className="relative aspect-video w-full bg-zinc-950">
            {mode === "video" ? (
              <>
                <video ref={videoRef} muted playsInline className="h-full w-full object-cover" />
                {!streamActive && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-zinc-400">
                    <Video className="h-10 w-10" />
                    <p className="text-sm">Camera preview will appear here</p>
                  </div>
                )}
              </>
            ) : (
              <div className="flex h-full w-full flex-col items-center justify-center gap-5 bg-[radial-gradient(ellipse_at_center,#27272a_0%,#09090b_70%)] px-6">
                <div
                  className={cn(
                    "flex h-20 w-20 items-center justify-center rounded-full border transition-all",
                    isRecording && !isPaused
                      ? "border-red-500/60 bg-red-500/15 text-red-400"
                      : "border-zinc-700 bg-zinc-800/80 text-zinc-200"
                  )}
                  style={
                    isRecording && !isPaused
                      ? { boxShadow: `0 0 ${30 + micLevel * 60}px rgba(239,68,68,.45)` }
                      : undefined
                  }
                >
                  <Mic className="h-8 w-8" />
                </div>
                <div className="flex h-16 w-full max-w-xl items-center justify-center gap-1">
                  {bars.map((v, i) => (
                    <span
                      key={i}
                      className={cn(
                        "w-1.5 rounded-full transition-all duration-150",
                        isRecording && !isPaused || streamActive ? "bg-emerald-400" : "bg-zinc-700"
                      )}
                      style={{ height: `${Math.max(8, v * 100)}%`, opacity: 0.35 + v * 0.65 }}
                    />
                  ))}
                </div>
                <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">
                  {isPaused ? "paused" : isRecording ? "capturing audio" : streamActive ? "mic live" : "mic off"}
                </p>
              </div>
            )}

            <div className="absolute left-4 top-4 flex items-center gap-2">
              <span
                className={cn(
                  "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold backdrop-blur-md",
                  isRecording && !isPaused
                    ? "bg-red-600/90 text-white"
                    : isPaused
                      ? "bg-amber-500/90 text-white"
                      : "bg-black/50 text-zinc-200"
                )}
              >
                <span
                  className={cn(
                    "h-2 w-2 rounded-full",
                    isRecording && !isPaused ? "animate-pulse bg-white" : isPaused ? "bg-white" : "bg-zinc-400"
                  )}
                />
                {statusLabel}
              </span>
            </div>

            <div className="absolute right-4 top-4 flex gap-2">
              <Button
                variant="outline"
                size="icon-sm"
                className="border-white/20 bg-black/50 text-white backdrop-blur-md hover:bg-black/70 hover:text-white"
                onClick={() => setOverlayVisible((v) => !v)}
                aria-label={overlayVisible ? "Hide note window" : "Show note window"}
              >
                {overlayVisible ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
              </Button>
              <Button
                variant="outline"
                size="icon-sm"
                className="border-white/20 bg-black/50 text-white backdrop-blur-md hover:bg-black/70 hover:text-white"
                onClick={() => {
                  setOverlayPos({ x: 0, y: 0 });
                  setOverlayText(DEFAULT_OVERLAY_TEXT);
                }}
                aria-label="Reset note window"
              >
                <RotateCcw className="h-4 w-4" />
              </Button>
            </div>

            {overlayVisible && (
              <div
                ref={overlayRef}
                onPointerDown={onOverlayPointerDown}
                onPointerMove={onOverlayPointerMove}
                onPointerUp={onOverlayPointerUp}
                className="absolute left-1/2 top-1/2 w-[min(90%,26rem)] -translate-x-1/2 -translate-y-1/2 cursor-move touch-none rounded-2xl border border-white/25 bg-zinc-900 text-white shadow-2xl backdrop-blur-xl"
                style={{
                  opacity: overlayOpacity[0] / 100,
                  transform: `translate(calc(-50% + ${overlayPos.x}px), calc(-50% + ${overlayPos.y}px))`,
                }}
              >
                <div className="flex items-center justify-between border-b border-white/10 px-4 py-2">
                  <div className="flex gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full bg-red-400/80" />
                    <span className="h-2.5 w-2.5 rounded-full bg-amber-300/80" />
                    <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/80" />
                  </div>
                  <span className="text-[11px] font-medium uppercase tracking-widest text-white/60">
                    Live note
                  </span>
                  <button
                    onClick={() => setOverlayVisible(false)}
                    className="cursor-pointer rounded-full px-1.5 text-sm leading-none text-white/60 hover:bg-white/10 hover:text-white"
                    aria-label="Close note"
                  >
                    ×
                  </button>
                </div>
                <textarea
                  value={overlayText}
                  onChange={(e) => setOverlayText(e.target.value)}
                  rows={4}
                  className="w-full cursor-text resize-none bg-transparent px-4 py-3 text-sm leading-relaxed text-white/90 outline-none placeholder:text-white/40"
                  placeholder="Type your script or notes here…"
                />
              </div>
            )}

            <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-3 bg-gradient-to-t from-black/70 to-transparent px-4 pb-4 pt-10">
              <div className="flex flex-wrap items-center gap-2">
                {!isRecording ? (
                  <Button variant="record" size="lg" onClick={startRecording} className="rounded-full">
                    <Circle className="h-4 w-4 fill-current" />
                    Record
                  </Button>
                ) : isPaused ? (
                  <>
                    <Button variant="record" size="lg" onClick={resumeRecording} className="rounded-full">
                      <Play className="h-4 w-4 fill-current" />
                      Resume
                    </Button>
                    <Button
                      variant="outline"
                      size="lg"
                      onClick={stopRecording}
                      className="rounded-full border-white/20 bg-white/10 text-white hover:bg-white/20 hover:text-white"
                    >
                      <Square className="h-4 w-4 fill-current" />
                      Stop
                    </Button>
                  </>
                ) : (
                  <Button variant="record" size="lg" onClick={stopRecording} className="rounded-full">
                    <Square className="h-4 w-4 fill-current" />
                    Stop · {formatTime(elapsed)}
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  className="border-white/20 bg-white/10 text-white backdrop-blur-md hover:bg-white/20 hover:text-white"
                  onClick={() => {
                    stopRecording();
                    void startPreview(mode);
                  }}
                >
                  Retry camera
                </Button>
              </div>
              <div className="hidden items-center gap-2 sm:flex">
                <Mic className="h-3.5 w-3.5 text-white/70" />
                <div className="h-1.5 w-28 overflow-hidden rounded-full bg-white/20">
                  <div
                    className="h-full rounded-full bg-emerald-400 transition-all duration-100"
                    style={{ width: `${Math.min(100, micLevel * 220)}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        </Card>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Overlay opacity</CardTitle>
              <CardDescription>How see-through the floating note window is.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4">
                <Slider
                  value={overlayOpacity}
                  onValueChange={setOverlayOpacity}
                  min={15}
                  max={100}
                  step={1}
                  className="flex-1"
                />
                <span className="w-12 text-right text-sm font-medium tabular-nums">
                  {overlayOpacity[0]}%
                </span>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Meter boost</CardTitle>
              <CardDescription>Visual boost for the mic meter. Mic input itself is unchanged.</CardDescription>
            </CardHeader>
            <CardContent>
              <MeterBoostSlider />
            </CardContent>
          </Card>
        </div>

        <section className="mt-8">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-base font-semibold tracking-tight">
              Takes <span className="text-zinc-400">({recordings.length})</span>
            </h2>
            {recordings.length > 0 && (
              <Button variant="ghost" size="sm" onClick={clearRecordings}>
                Clear all
              </Button>
            )}
          </div>
          {recordings.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center gap-2 py-10 text-center">
                {mode === "video" ? (
                  <Video className="h-8 w-8 text-zinc-300" />
                ) : (
                  <Mic className="h-8 w-8 text-zinc-300" />
                )}
                <p className="text-sm font-medium">No takes yet</p>
                <p className="max-w-sm text-xs text-zinc-500">
                  Hit <strong>Record</strong>, perform your take, then press <strong>Stop</strong>.
                  Tap <strong>?</strong> anytime for the voice assistant — recording pauses automatically.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {recordings.map((r) => (
                <Card key={r.id} className="overflow-hidden">
                  <CardContent className="p-0">
                    {r.mode === "video" ? (
                      <video src={r.url} controls playsInline className="aspect-video w-full bg-black" />
                    ) : (
                      <div className="flex flex-col gap-3 bg-zinc-950 p-4">
                        <div className="flex items-center gap-2 text-xs text-zinc-400">
                          <Mic className="h-3.5 w-3.5" /> Voice take · {formatTime(r.duration)}
                        </div>
                        <audio src={r.url} controls className="w-full" />
                      </div>
                    )}
                    <div className="flex items-center justify-between gap-2 p-3">
                      <div className="text-xs text-zinc-500">
                        {r.mode === "video" ? "Video" : "Voice"} · {formatTime(r.duration)} ·{" "}
                        {r.createdAt.toLocaleTimeString()}
                      </div>
                      <div className="flex gap-1.5">
                        <a
                          href={r.url}
                          download={`take-${r.id}.webm`}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-zinc-200 hover:bg-zinc-100"
                          aria-label="Download take"
                        >
                          <Download className="h-4 w-4" />
                        </a>
                        <button
                          onClick={() => deleteRecording(r.id)}
                          className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border border-zinc-200 text-red-600 hover:bg-red-50"
                          aria-label="Delete take"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

function MeterBoostSlider() {
  const [v, setV] = useState([100]);
  return (
    <div className="flex items-center gap-4">
      <Slider value={v} onValueChange={setV} min={20} max={200} step={5} className="flex-1" />
      <span className="w-12 text-right text-sm font-medium tabular-nums">{v[0]}%</span>
    </div>
  );
}
