import { MAX_FRAME_BYTES, sampleTimes, type SceneFrame } from "./scene-feedback";

export async function extractVideoFrames(blob: Blob, signal: AbortSignal): Promise<SceneFrame[]> {
  const workSignal = AbortSignal.any([signal, AbortSignal.timeout(45_000)]);
  workSignal.throwIfAborted();
  if (!blob.size || !blob.type.startsWith("video/")) throw new Error("This recording has no video to analyze.");
  const video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  video.preload = "auto";
  const url = URL.createObjectURL(blob);

  function waitFor(event: string, action: () => void): Promise<void> {
    return new Promise((resolve, reject) => {
      function cleanup() {
        video.removeEventListener(event, success);
        video.removeEventListener("error", failure);
        workSignal.removeEventListener("abort", aborted);
      }
      function success() { cleanup(); resolve(); }
      function failure() { cleanup(); reject(new Error("Could not decode this video for scene analysis.")); }
      function aborted() { cleanup(); reject(workSignal.reason); }
      if (workSignal.aborted) { reject(workSignal.reason); return; }
      video.addEventListener(event, success, { once: true });
      video.addEventListener("error", failure, { once: true });
      workSignal.addEventListener("abort", aborted, { once: true });
      try { action(); } catch (error) { cleanup(); reject(error); }
    });
  }

  try {
    await waitFor("loadeddata", () => { video.src = url; video.load(); });
    // MediaRecorder WebM can omit duration metadata. Seeking to the end lets
    // the browser discover actual media duration (excluding recording pauses).
    if (!Number.isFinite(video.duration)) {
      await waitFor("seeked", () => { video.currentTime = 1e10; });
    }
    const times = sampleTimes(video.duration);
    if (!video.videoWidth || !video.videoHeight) throw new Error("No camera frames were recorded.");
    const canvas = document.createElement("canvas");
    const scale = Math.min(1, 768 / Math.max(video.videoWidth, video.videoHeight));
    canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
    canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("This browser cannot prepare scene images.");
    const frames: SceneFrame[] = [];
    for (const time of times) {
      workSignal.throwIfAborted();
      await waitFor("seeked", () => { video.currentTime = time; });
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      let image = canvas.toDataURL("image/jpeg", 0.7);
      if ((image.length - 23) * 0.75 > MAX_FRAME_BYTES) image = canvas.toDataURL("image/jpeg", 0.45);
      if (!image.startsWith("data:image/jpeg;base64,") || (image.length - 23) * 0.75 > MAX_FRAME_BYTES) {
        throw new Error("Scene images are too large. Try a shorter recording.");
      }
      frames.push({ timestamp_ms: Math.round(time * 1000), image_url: image });
    }
    return frames;
  } finally {
    video.pause();
    video.removeAttribute("src");
    video.load();
    URL.revokeObjectURL(url);
  }
}
