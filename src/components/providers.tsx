"use client";

import { RecordingProvider } from "@/context/recording-context";

export function Providers({ children }: { children: React.ReactNode }) {
  return <RecordingProvider>{children}</RecordingProvider>;
}
