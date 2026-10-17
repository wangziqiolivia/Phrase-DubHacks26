"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, AudioWaveform, Mic, Send, Sparkles } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useRecording } from "@/context/recording-context";
import { mockAssistantReply } from "@/lib/assistant-replies";
import { cn, formatTime } from "@/lib/utils";

type Role = "user" | "assistant";

interface ChatMessage {
  id: string;
  role: Role;
  text: string;
}

type SpeechRecognitionCtor = new () => SpeechRecognition;

function getSpeechRecognition(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as Window & {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function AssistantChat() {
  const { isRecording, isPaused, elapsed, resumeRecording } = useRecording();
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      text: "Hi — I'm your Capture Studio assistant. Ask how recording works, or use the mic to ask by voice. Your take is safe while you're here.",
    },
  ]);
  const [draft, setDraft] = useState("");
  const [listening, setListening] = useState(false);
  const [voiceSupported, setVoiceSupported] = useState(true);
  const listRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  useEffect(() => {
    setVoiceSupported(!!getSpeechRecognition());
  }, []);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const sendMessage = useCallback((text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    const userMsg: ChatMessage = { id: crypto.randomUUID(), role: "user", text: trimmed };
    setMessages((prev) => [...prev, userMsg]);
    setDraft("");
    window.setTimeout(() => {
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          text: mockAssistantReply(trimmed),
        },
      ]);
    }, 400);
  }, []);

  const toggleVoice = () => {
    const Ctor = getSpeechRecognition();
    if (!Ctor) return;
    if (listening) {
      recognitionRef.current?.stop();
      setListening(false);
      return;
    }
    const rec = new Ctor();
    rec.continuous = false;
    rec.interimResults = true;
    rec.lang = "en-US";
    rec.onresult = (event: SpeechRecognitionEvent) => {
      let transcript = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript;
      }
      setDraft(transcript);
      if (event.results[event.results.length - 1]?.isFinal) {
        sendMessage(transcript);
        setListening(false);
      }
    };
    rec.onerror = () => setListening(false);
    rec.onend = () => setListening(false);
    recognitionRef.current = rec;
    rec.start();
    setListening(true);
  };

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-b from-zinc-50 to-zinc-200/60 text-zinc-950">
      <header className="border-b border-zinc-200/80 bg-zinc-50/90 backdrop-blur-md">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-3 px-4 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-zinc-900 text-white shadow">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-widest text-zinc-500">
                Help assistant
              </p>
              <h1 className="text-lg font-semibold tracking-tight">Ask while you record</h1>
            </div>
          </div>
          <Link
            href="/"
            className={cn(buttonVariants({ variant: "outline", size: "default" }), "shrink-0")}
          >
            <ArrowLeft className="h-4 w-4" />
            Exit
          </Link>
        </div>
      </header>

      {isRecording && isPaused && (
        <div className="border-b border-amber-200 bg-amber-50 px-4 py-3 sm:px-6">
          <div className="mx-auto flex max-w-3xl flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-amber-950">
              <span className="font-semibold">Recording paused</span> at {formatTime(elapsed)} —
              microphone and camera stay active in the background.
            </p>
            <Link
              href="/"
              onClick={() => resumeRecording()}
              className={cn(buttonVariants({ variant: "default", size: "sm" }), "w-fit")}
            >
              <AudioWaveform className="h-4 w-4" />
              Resume &amp; return
            </Link>
          </div>
        </div>
      )}

      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 py-4 sm:px-6 sm:py-6">
        <Card className="flex min-h-[min(70vh,640px)] flex-1 flex-col overflow-hidden shadow-sm">
          <CardContent className="flex flex-1 flex-col p-0">
            <div
              ref={listRef}
              className="flex-1 space-y-4 overflow-y-auto p-4 sm:p-5"
              role="log"
              aria-live="polite"
              aria-label="Chat messages"
            >
              {messages.map((m) => (
                <div
                  key={m.id}
                  className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}
                >
                  <div
                    className={cn(
                      "max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm",
                      m.role === "user"
                        ? "rounded-br-md bg-zinc-900 text-white"
                        : "rounded-bl-md border border-zinc-200 bg-white text-zinc-800"
                    )}
                  >
                    {m.role === "assistant" && (
                      <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-zinc-400">
                        Assistant
                      </p>
                    )}
                    {m.text}
                  </div>
                </div>
              ))}
            </div>

            <div className="border-t border-zinc-200 bg-zinc-50/80 p-3 sm:p-4">
              {!voiceSupported && (
                <p className="mb-2 text-xs text-zinc-500">
                  Voice input is not supported in this browser — type your question below.
                </p>
              )}
              <form
                className="flex items-end gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  sendMessage(draft);
                }}
              >
                <button
                  type="button"
                  disabled={!voiceSupported}
                  onClick={toggleVoice}
                  aria-label={listening ? "Stop voice input" : "Start voice input"}
                  aria-pressed={listening}
                  className={cn(
                    buttonVariants({ variant: listening ? "default" : "outline", size: "icon" }),
                    listening && "animate-pulse bg-red-600 hover:bg-red-600"
                  )}
                >
                  <Mic className="h-5 w-5" />
                </button>
                <textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  rows={1}
                  placeholder={listening ? "Listening…" : "Ask about recording, transcripts, overlays…"}
                  className="max-h-32 min-h-10 flex-1 resize-none rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-zinc-950"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      sendMessage(draft);
                    }
                  }}
                />
                <button
                  type="submit"
                  disabled={!draft.trim()}
                  className={cn(
                    buttonVariants({ variant: "default", size: "icon" }),
                    "disabled:opacity-40"
                  )}
                  aria-label="Send message"
                >
                  <Send className="h-4 w-4" />
                </button>
              </form>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
