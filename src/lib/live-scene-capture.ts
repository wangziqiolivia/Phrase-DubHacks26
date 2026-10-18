import { LIVE_BATCH_FRAMES, LIVE_FRAME_INTERVAL_MS, MAX_FRAME_BYTES, MAX_PENDING_FRAMES, type SceneFeedback, type SceneFrame } from "./scene-feedback";

interface LiveCallbacks {
  isPaused: () => boolean;
  getText: () => string;
  sendFrames: (frames: SceneFrame[], text: string, signal: AbortSignal) => Promise<SceneFeedback>;
  onFeedback: (feedback: SceneFeedback, frameCount: number, hasTranscript: boolean) => void;
  onError: (error: Error) => void;
  onStatus: () => void;
}

export function startLiveSceneCapture(video: HTMLVideoElement, callbacks: LiveCallbacks) {
  const controller = new AbortController();
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  const start = performance.now();
  let pending: SceneFrame[] = [];
  let inFlight = false;
  let finished = false;
  let nextSendAt = 0;

  async function flush() {
    if (controller.signal.aborted || inFlight || !pending.length) return;
    if (!finished && (pending.length < LIVE_BATCH_FRAMES || performance.now() < nextSendAt)) return;
    const batch = pending;
    pending = [];
    const text = callbacks.getText();
    inFlight = true;
    callbacks.onStatus();
    try {
      const feedback = await callbacks.sendFrames(batch, text, controller.signal);
      if (!controller.signal.aborted) callbacks.onFeedback(feedback, batch.length, !!text.trim());
    } catch (cause) {
      if (!controller.signal.aborted) {
        nextSendAt = performance.now() + 10_000;
        callbacks.onError(cause instanceof Error ? cause : new Error("Live scene feedback failed."));
      }
    } finally {
      inFlight = false;
      if (finished && !controller.signal.aborted && pending.length) void flush();
    }
  }

  const timer = setInterval(() => {
    if (finished || controller.signal.aborted || callbacks.isPaused()) return;
    if (video.readyState < 2 || !video.videoWidth || !video.videoHeight) return;
    try {
      if (!context) throw new Error("This browser cannot capture camera images.");
      const scale = Math.min(1, 768 / Math.max(video.videoWidth, video.videoHeight));
      canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
      canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      let image = canvas.toDataURL("image/jpeg", 0.65);
      if ((image.length - 23) * 0.75 > MAX_FRAME_BYTES) image = canvas.toDataURL("image/jpeg", 0.4);
      if (!image.startsWith("data:image/jpeg;base64,") || (image.length - 23) * 0.75 > MAX_FRAME_BYTES) throw new Error("Camera images are too large to send.");
      pending.push({ timestamp_ms: Math.round(performance.now() - start), image_url: image });
      // ponytail: retain only the newest frames if the model is slower than capture.
      // This keeps latency and memory bounded instead of queuing an entire video.
      pending = pending.slice(-MAX_PENDING_FRAMES);
      void flush();
    } catch (cause) {
      clearInterval(timer);
      finished = true;
      callbacks.onError(cause instanceof Error ? cause : new Error("Could not capture camera images."));
    }
  }, LIVE_FRAME_INTERVAL_MS);

  return {
    finish() { finished = true; clearInterval(timer); void flush(); },
    abort() { finished = true; clearInterval(timer); pending = []; controller.abort(); },
  };
}
