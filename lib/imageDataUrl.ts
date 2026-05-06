/**
 * Browser-only helpers to turn a File / Blob into a compact webp data URL.
 * Used by IndexedDB session persistence so reloads can re-render thumbnails.
 */

export async function fileToDataUrl(
  file: Blob,
  opts: { maxEdge?: number; quality?: number; mimeType?: string } = {}
): Promise<string> {
  if (typeof window === "undefined") throw new Error("browser only");
  const { maxEdge = 720, quality = 0.82, mimeType = "image/webp" } = opts;
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    const ratio = Math.min(1, maxEdge / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.max(1, Math.round(img.naturalWidth * ratio));
    const h = Math.max(1, Math.round(img.naturalHeight * ratio));
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    const ctx = c.getContext("2d");
    if (!ctx) throw new Error("Canvas 2D context unavailable");
    ctx.drawImage(img, 0, 0, w, h);
    return c.toDataURL(mimeType, quality);
  } finally {
    URL.revokeObjectURL(url);
  }
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Image decode failed"));
    img.src = url;
  });
}
