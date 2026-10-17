"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowLeft, Type } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  SAMPLE_SESSION_TITLE,
  SAMPLE_TRANSCRIPT,
  type TextSize,
  type TranscriptFilter,
} from "@/lib/sample-transcript";

const TEXT_SIZE_CLASS: Record<TextSize, string> = {
  sm: "text-sm leading-relaxed",
  md: "text-base leading-relaxed",
  lg: "text-lg leading-loose",
};

export function TranscriptReview() {
  const [filter, setFilter] = useState<TranscriptFilter>("full");
  const [textSize, setTextSize] = useState<TextSize>("md");

  const visibleSegments = useMemo(() => {
    if (filter === "mistakes") {
      return SAMPLE_TRANSCRIPT.filter((s) => s.isMistake);
    }
    return SAMPLE_TRANSCRIPT;
  }, [filter]);

  const mistakeCount = SAMPLE_TRANSCRIPT.filter((s) => s.isMistake).length;

  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-50 to-zinc-200/60 text-zinc-950">
      <header className="sticky top-0 z-10 border-b border-zinc-200/80 bg-zinc-50/90 backdrop-blur-md">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 py-4 sm:px-6">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium uppercase tracking-widest text-zinc-500">
                Transcript review
              </p>
              <h1 className="mt-1 truncate text-xl font-semibold tracking-tight sm:text-2xl">
                {SAMPLE_SESSION_TITLE}
              </h1>
            </div>
            <Link
              href="/"
              className={cn(buttonVariants({ variant: "outline", size: "default" }), "shrink-0")}
            >
              <ArrowLeft className="h-4 w-4" />
              Exit
            </Link>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div
              role="tablist"
              aria-label="Transcript filter"
              className="inline-flex w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-1 shadow-sm sm:w-auto"
            >
              {(
                [
                  { id: "full" as const, label: "Full transcript" },
                  { id: "mistakes" as const, label: "Only mistakes" },
                ] as const
              ).map(({ id, label }) => (
                <button
                  key={id}
                  role="tab"
                  aria-selected={filter === id}
                  onClick={() => setFilter(id)}
                  className={cn(
                    "flex-1 cursor-pointer rounded-xl px-3 py-2 text-sm font-medium transition-all sm:flex-none sm:px-4",
                    filter === id
                      ? "bg-zinc-900 text-white shadow"
                      : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
                  )}
                >
                  {label}
                  {id === "mistakes" && (
                    <span
                      className={cn(
                        "ml-1.5 tabular-nums",
                        filter === id ? "text-zinc-300" : "text-zinc-400"
                      )}
                    >
                      ({mistakeCount})
                    </span>
                  )}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <Type className="h-4 w-4 text-zinc-500" aria-hidden />
              <span className="text-xs font-medium text-zinc-500">Text size</span>
              <div
                role="group"
                aria-label="Text size"
                className="flex rounded-xl border border-zinc-200 bg-white p-0.5 shadow-sm"
              >
                {(
                  [
                    { id: "sm" as const, label: "S" },
                    { id: "md" as const, label: "M" },
                    { id: "lg" as const, label: "L" },
                  ] as const
                ).map(({ id, label }) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setTextSize(id)}
                    aria-pressed={textSize === id}
                    className={cn(
                      "min-w-[2.25rem] cursor-pointer rounded-lg px-2 py-1.5 text-sm font-semibold transition-all",
                      textSize === id
                        ? "bg-zinc-900 text-white"
                        : "text-zinc-600 hover:bg-zinc-100"
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl px-4 py-6 pb-16 sm:px-6">
        {visibleSegments.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-sm font-medium">No flagged mistakes</p>
              <p className="mt-1 text-sm text-zinc-500">
                Switch to full transcript to read everything from this session.
              </p>
            </CardContent>
          </Card>
        ) : (
          <ul className="space-y-3" aria-live="polite">
            {visibleSegments.map((segment) => (
              <li key={segment.id}>
                <Card
                  className={cn(
                    segment.isMistake && filter === "full" && "border-amber-200 bg-amber-50/40"
                  )}
                >
                  <CardContent className="p-4 sm:p-5">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <time
                        dateTime={`PT${segment.timestamp.replace(":", "M")}S`}
                        className="text-xs font-medium tabular-nums text-zinc-500"
                      >
                        {segment.timestamp}
                      </time>
                      {segment.isMistake && (
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-900">
                          Mistake
                        </span>
                      )}
                    </div>
                    <p className={cn("text-zinc-900", TEXT_SIZE_CLASS[textSize])}>
                      {segment.text}
                    </p>
                    {segment.isMistake && segment.correction && (
                      <p
                        className={cn(
                          "mt-3 border-t border-amber-200/80 pt-3 text-zinc-600",
                          textSize === "lg" ? "text-base" : "text-sm"
                        )}
                      >
                        Suggested:{" "}
                        <span className="font-medium text-zinc-900">{segment.correction}</span>
                      </p>
                    )}
                  </CardContent>
                </Card>
              </li>
            ))}
          </ul>
        )}

        {filter === "full" && (
          <p className="mt-6 text-center text-xs text-zinc-500">
            Sample transcript for review. Live speech-to-text can replace this in a later iteration.
          </p>
        )}
      </main>
    </div>
  );
}
