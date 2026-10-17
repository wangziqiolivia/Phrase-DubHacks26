export function mockAssistantReply(userText: string): string {
  const q = userText.toLowerCase().trim();
  if (!q) return "I didn't catch that — try speaking again or type your question.";
  if (q.includes("pause") || q.includes("resume") || q.includes("record")) {
    return "Your take stays paused while you're here. Use Exit to return to the studio — tap Resume on the transport bar to continue recording.";
  }
  if (q.includes("transcript") || q.includes("mistake")) {
    return "Open Review transcript from the studio header to read the full session or filter to only flagged mistakes.";
  }
  if (q.includes("overlay") || q.includes("note")) {
    return "The floating Live note sits on top of the stage. Drag it, edit the text, or adjust Overlay opacity on the main page.";
  }
  if (q.includes("voice") || q.includes("video")) {
    return "Switch modes with the Video / Voice toggle at the top of Capture Studio. Voice mode shows a waveform stage; Video adds camera preview.";
  }
  return "Got it. I'm a local demo assistant — I can explain Capture Studio features. Ask about recording, transcripts, overlays, or voice vs video mode.";
}
