"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, AudioWaveform, Mic, Send, Sparkles } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useRecording } from "@/context/recording-context";
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

const speechLanguageCodes: Record<string, string> = {
  English: "en-US",
  Hindi: "hi-IN",
  French: "fr-FR",
  Japanese: "ja-JP",
  Spanish: "es-ES",
};

export function AssistantChat() {
  const { isRecording, isPaused, elapsed, resumeRecording } = useRecording();
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      text: "Hi there! I'm here to answer any questions you have. Just talk in any language you prefer. Feel free to ask follow up questions!",
    },
  ]);
  const [draft, setDraft] = useState("");
  const [listening, setListening] = useState(false);
  const [voiceSupported, setVoiceSupported] = useState(true);
  const listRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  const [sourceLanguage, setSourceLanguage] = useState("English");
  const [targetLanguage, setTargetLanguage] = useState("Spanish");
  const [level, setLevel] = useState("beginner");
  const [isSending, setIsSending] = useState(false);

  useEffect(() => {
    setVoiceSupported(!!getSpeechRecognition());
  }, []);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || isSending) return;

      setMessages((prev) => [
        ...prev,
        { id: crypto.randomUUID(), role: "user", text: trimmed },
      ]);
      setDraft("");
      setIsSending(true);

      try {
        const response = await fetch("/api/assistant", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text: trimmed,
            sourceLanguage,
            targetLanguage,
            level,
          }),
        });

        const data = (await response.json()) as {
          reply?: string;
          error?: string;
        };

        if (!response.ok) {
          throw new Error(data.error ?? "The assistant request failed.");
        }

        setMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            role: "assistant",
            text: data.reply ?? "I couldn't create a reply. Please try again.",
          },
        ]);
      } catch (caught) {
        const message =
          caught instanceof Error ? caught.message : "Something went wrong.";

        setMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            role: "assistant",
            text: `I couldn't get language help: ${message}`,
          },
        ]);
      } finally {
        setIsSending(false);
      }
    },
    [sourceLanguage, targetLanguage, level, isSending],
  );

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
    rec.lang = speechLanguageCodes[sourceLanguage] ?? "en-US";
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
                Personal language tutor
              </p>
              <h1 className="text-lg font-semibold tracking-tight">
                Ask anything here! The recording is paused.
              </h1>
            </div>
          </div>

          <Link
            href="/"
            className={cn(
              buttonVariants({ variant: "outline", size: "default" }),
              "shrink-0",
            )}
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
              <span className="font-semibold">Recording paused</span> at{" "}
              {formatTime(elapsed)} — microphone and camera stay active in the
              background.
            </p>
            <Link
              href="/"
              onClick={() => resumeRecording()}
              className={cn(
                buttonVariants({ variant: "default", size: "sm" }),
                "w-fit",
              )}
            >
              <AudioWaveform className="h-4 w-4" />
              Resume &amp; return
            </Link>
          </div>
        </div>
      )}

      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 py-4 sm:px-6 sm:py-6">
        <div className="mb-4 grid gap-3 rounded-2xl border border-zinc-200 bg-white p-4 sm:grid-cols-3">
          <label className="text-xs font-medium text-zinc-600">
            I’m writing in
            <select
              className="mt-1 block w-full rounded-lg border border-zinc-200 bg-white p-2 text-sm"
              value={sourceLanguage}
              onChange={(event) => setSourceLanguage(event.target.value)}
            >
              <option>English</option>
              <option>Hindi</option>
              <option>French</option>
              <option>Japanese</option>
              <option>Spanish</option>
            </select>
          </label>

          <label className="text-xs font-medium text-zinc-600">
            I’m learning
            <select
              className="mt-1 block w-full rounded-lg border border-zinc-200 bg-white p-2 text-sm"
              value={targetLanguage}
              onChange={(event) => setTargetLanguage(event.target.value)}
            >
              <option>Spanish</option>
              <option>French</option>
              <option>Japanese</option>
              <option>Hindi</option>
            </select>
          </label>

          <label className="text-xs font-medium text-zinc-600">
            My level
            <select
              className="mt-1 block w-full rounded-lg border border-zinc-200 bg-white p-2 text-sm"
              value={level}
              onChange={(event) => setLevel(event.target.value)}
            >
              <option value="beginner">Beginner</option>
              <option value="intermediate">Intermediate</option>
              <option value="advanced">Advanced</option>
            </select>
          </label>
        </div>

        <Card className="flex min-h-[min(70vh,640px)] flex-1 flex-col overflow-hidden shadow-sm">
          <CardContent className="flex flex-1 flex-col p-0">
            <div
              ref={listRef}
              className="flex-1 space-y-4 overflow-y-auto p-4 sm:p-5"
              role="log"
              aria-live="polite"
              aria-label="Chat messages"
            >
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={cn(
                    "flex",
                    message.role === "user" ? "justify-end" : "justify-start",
                  )}
                >
                  <div
                    className={cn(
                      "max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm",
                      message.role === "user"
                        ? "rounded-br-md bg-zinc-900 text-white"
                        : "rounded-bl-md border border-zinc-200 bg-white text-zinc-800",
                    )}
                  >
                    {message.role === "assistant" && (
                      <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-zinc-400">
                        Assistant
                      </p>
                    )}
                    {message.text}
                  </div>
                </div>
              ))}

              {isSending && (
                <p className="text-sm text-zinc-500" role="status">
                  Preparing translation and tips…
                </p>
              )}
            </div>

            <div className="border-t border-zinc-200 bg-zinc-50/80 p-3 sm:p-4">
              {!voiceSupported && (
                <p className="mb-2 text-xs text-zinc-500">
                  Voice input is not supported in this browser — type your
                  question below.
                </p>
              )}

              <form
                className="flex items-end gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                void sendMessage(draft);
              }}
              >
                <button
                  type="button"
                  disabled={!voiceSupported || isSending}
                  onClick={toggleVoice}
                  aria-label={listening ? "Stop voice input" : "Start voice input"}
                  aria-pressed={listening}
                  className={cn(
                    buttonVariants({
                      variant: listening ? "default" : "outline",
                      size: "icon",
                    }),
                    listening && "animate-pulse bg-red-600 hover:bg-red-600",
                  )}
                >
                  <Mic className="h-5 w-5" />
                </button>

                <textarea
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  rows={1}
                  placeholder={
                    listening
                      ? "Listening…"
                      : `Write in ${sourceLanguage} or ask for a ${targetLanguage} translation…`
                  }
                  className="max-h-32 min-h-10 flex-1 resize-none rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-zinc-950"
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey && !isSending) {
                      event.preventDefault();
                      void sendMessage(draft);
                    }
                  }}
                />

                <button
                  type="submit"
                  disabled={!draft.trim() || isSending}
                  className={cn(
                    buttonVariants({ variant: "default", size: "icon" }),
                    "disabled:opacity-40",
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
