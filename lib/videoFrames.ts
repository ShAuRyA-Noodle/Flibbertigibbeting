/**
 * Browser-only: sample N evenly-spaced frames from a video Blob, return JPEG Files.
 * Uses HTMLVideoElement + canvas. No server roundtrip.
 */

export type VideoFrameOptions = {
  /** Number of frames to sample, evenly distributed across duration. */
  frameCount?: number;
  /** Maximum long edge of output JPEG. */
  maxEdge?: number;
  /** JPEG quality 0-1. */
  quality?: number;
  /** Per-frame progress callback. */
  onProgress?: (i: number, total: number, dataUrl: string) => void;
};

export async function extractFrames(
  blob: Blob,
  opts: VideoFrameOptions = {}
): Promise<File[]> {
  if (typeof window === "undefined") throw new Error("browser only");

  const { frameCount = 8, maxEdge = 1280, quality = 0.88, onProgress } = opts;
  const url = URL.createObjectURL(blob);
  const video = document.createElement("video");
  video.preload = "auto";
  video.muted = true;
  video.playsInline = true;
  video.src = url;

  try {
    await waitForVideoReady(video);
    const duration = isFinite(video.duration) && video.duration > 0 ? video.duration : 0;
    if (duration === 0) throw new Error("Video has no readable duration");

    const W0 = video.videoWidth;
    const H0 = video.videoHeight;
    if (W0 === 0 || H0 === 0) throw new Error("Video has no dimensions");
    const ratio = Math.min(1, maxEdge / Math.max(W0, H0));
    const W = Math.round(W0 * ratio);
    const H = Math.round(H0 * ratio);

    const canvas = document.createElement("canvas");
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas 2D context unavailable");

    const files: File[] = [];
    const total = Math.max(1, Math.min(24, Math.floor(frameCount)));

    // Skip very edges (first/last few percent) — less informative
    const startPct = 0.04;
    const endPct = 0.96;

    for (let i = 0; i < total; i++) {
      const t = total === 1
        ? duration * 0.5
        : duration * (startPct + (endPct - startPct) * (i / (total - 1)));
      await seekVideo(video, Math.min(duration - 0.05, Math.max(0, t)));
      ctx.drawImage(video, 0, 0, W, H);
      const dataUrl = canvas.toDataURL("image/jpeg", quality);
      const fileBlob = await dataUrlToBlob(dataUrl);
      const file = new File(
        [fileBlob],
        `flyover-frame-${String(i + 1).padStart(2, "0")}-${formatTimestamp(t)}.jpg`,
        { type: "image/jpeg" }
      );
      files.push(file);
      onProgress?.(i + 1, total, dataUrl);
    }
    return files;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function waitForVideoReady(video: HTMLVideoElement): Promise<void> {
  return new Promise((resolve, reject) => {
    if (video.readyState >= 2) return resolve();
    const onLoaded = () => {
      video.removeEventListener("loadeddata", onLoaded);
      video.removeEventListener("error", onError);
      resolve();
    };
    const onError = () => {
      video.removeEventListener("loadeddata", onLoaded);
      video.removeEventListener("error", onError);
      reject(new Error("Video failed to load"));
    };
    video.addEventListener("loadeddata", onLoaded);
    video.addEventListener("error", onError);
  });
}

function seekVideo(video: HTMLVideoElement, t: number): Promise<void> {
  return new Promise((resolve, reject) => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const onSeeked = () => {
      cleanup();
      // give the frame a tick to commit
      setTimeout(resolve, 30);
    };
    const onError = () => {
      cleanup();
      reject(new Error("Seek error"));
    };
    function cleanup() {
      video.removeEventListener("seeked", onSeeked);
      video.removeEventListener("error", onError);
      if (timer != null) clearTimeout(timer);
    }
    video.addEventListener("seeked", onSeeked);
    video.addEventListener("error", onError);
    timer = setTimeout(() => {
      cleanup();
      reject(new Error("Seek timed out"));
    }, 8000);
    try {
      video.currentTime = t;
    } catch (e) {
      cleanup();
      reject(e instanceof Error ? e : new Error(String(e)));
    }
  });
}

async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  const res = await fetch(dataUrl);
  return res.blob();
}

function formatTimestamp(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${String(m).padStart(2, "0")}m${String(s).padStart(2, "0")}s`;
}
