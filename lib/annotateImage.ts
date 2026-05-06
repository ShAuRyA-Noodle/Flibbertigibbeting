import type { PanelAnalysis, Severity } from "./schema";

const SEV_COLORS: Record<Severity, string> = {
  low: "#18a96b",
  medium: "#d49500",
  high: "#e64a00",
  critical: "#c8102e",
};

/**
 * Render a panel image with its grounded defect bounding boxes burned in,
 * plus a Solpop / panel-ID watermark. Browser-only.
 */
export async function annotatePanelToBlob(
  panel: PanelAnalysis,
  imgUrl: string,
  opts: {
    maxWidth?: number;
    quality?: number;
    format?: "image/png" | "image/jpeg" | "image/webp";
  } = {}
): Promise<Blob> {
  if (typeof window === "undefined") throw new Error("browser only");

  const img = await loadImage(imgUrl);
  const srcW = img.naturalWidth || img.width;
  const srcH = img.naturalHeight || img.height;
  if (srcW === 0 || srcH === 0) throw new Error("Image has no dimensions");

  const targetW = opts.maxWidth && opts.maxWidth < srcW ? opts.maxWidth : srcW;
  const ratio = targetW / srcW;
  const W = Math.round(srcW * ratio);
  const H = Math.round(srcH * ratio);

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context unavailable");

  // Base image
  ctx.drawImage(img, 0, 0, W, H);

  // Defect overlays
  const grounded = panel.defects.filter((d) => Array.isArray(d.bbox));
  const fontSize = Math.max(13, Math.round(W * 0.013));
  const monoFont = `${fontSize}px Menlo, "Geist Mono", ui-monospace, monospace`;

  ctx.lineJoin = "round";
  ctx.textBaseline = "top";

  for (let i = 0; i < grounded.length; i++) {
    const d = grounded[i];
    if (!d.bbox) continue;
    const [ymin, xmin, ymax, xmax] = d.bbox;
    const x = Math.round(xmin * W);
    const y = Math.round(ymin * H);
    const w = Math.round((xmax - xmin) * W);
    const h = Math.round((ymax - ymin) * H);
    const color = SEV_COLORS[d.severity];

    // Soft fill
    ctx.fillStyle = color + "22";
    ctx.fillRect(x, y, w, h);

    // Stroke
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(2, Math.round(W * 0.0024));
    ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);

    // Corner ticks for premium feel
    const tick = Math.max(8, Math.round(W * 0.014));
    ctx.lineWidth = Math.max(2.5, Math.round(W * 0.0028));
    drawCorner(ctx, x, y, tick, "tl");
    drawCorner(ctx, x + w, y, tick, "tr");
    drawCorner(ctx, x, y + h, tick, "bl");
    drawCorner(ctx, x + w, y + h, tick, "br");

    // Label pill
    const labelText = `${i + 1} · ${d.type} · ${d.estimatedEfficiencyLoss.toFixed(1)}%`;
    ctx.font = `bold ${monoFont}`;
    const metrics = ctx.measureText(labelText);
    const padX = Math.round(fontSize * 0.7);
    const padY = Math.round(fontSize * 0.45);
    const labelW = Math.round(metrics.width + padX * 2);
    const labelH = Math.round(fontSize + padY * 2);

    let labelX = x;
    let labelY = y - labelH - 2;
    if (labelY < 0) labelY = y + 2;
    if (labelX + labelW > W) labelX = Math.max(0, W - labelW);

    // Pill background
    ctx.fillStyle = color;
    roundRect(ctx, labelX, labelY, labelW, labelH, Math.round(labelH / 2));
    ctx.fill();

    // Pill text
    ctx.fillStyle = "#0a0a0a";
    ctx.fillText(labelText, labelX + padX, labelY + padY);
  }

  // Watermark (bottom-right): SOLPOP · panelId · timestamp
  const stamp = `SOLPOP · ${panel.panelId} · ${new Date().toISOString().slice(0, 10)}`;
  const stampSize = Math.max(11, Math.round(W * 0.011));
  ctx.font = `${stampSize}px Menlo, "Geist Mono", ui-monospace, monospace`;
  const stampMetrics = ctx.measureText(stamp);
  const stampPad = Math.round(stampSize * 0.7);
  const stampW = Math.round(stampMetrics.width + stampPad * 2);
  const stampH = Math.round(stampSize + stampPad * 1.5);
  const stampX = W - stampW - 14;
  const stampY = H - stampH - 14;

  ctx.fillStyle = "rgba(10, 10, 10, 0.65)";
  roundRect(ctx, stampX, stampY, stampW, stampH, Math.round(stampH / 2));
  ctx.fill();
  ctx.fillStyle = "#fff8ee";
  ctx.fillText(stamp, stampX + stampPad, stampY + stampPad * 0.75);

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Canvas.toBlob returned null"))),
      opts.format ?? "image/png",
      opts.quality ?? 0.95
    );
  });
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    // Allow same-origin and data URLs; cross-origin would need CORS-enabled servers.
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Image load failed"));
    img.src = url;
  });
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

function drawCorner(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  len: number,
  pos: "tl" | "tr" | "bl" | "br"
) {
  ctx.beginPath();
  switch (pos) {
    case "tl":
      ctx.moveTo(x, y + len);
      ctx.lineTo(x, y);
      ctx.lineTo(x + len, y);
      break;
    case "tr":
      ctx.moveTo(x - len, y);
      ctx.lineTo(x, y);
      ctx.lineTo(x, y + len);
      break;
    case "bl":
      ctx.moveTo(x, y - len);
      ctx.lineTo(x, y);
      ctx.lineTo(x + len, y);
      break;
    case "br":
      ctx.moveTo(x - len, y);
      ctx.lineTo(x, y);
      ctx.lineTo(x, y - len);
      break;
  }
  ctx.stroke();
}

export function safeFileStub(panel: PanelAnalysis): string {
  const base = panel.fileName
    .replace(/\.[^.]+$/, "")
    .replace(/[^a-zA-Z0-9-_]+/g, "-")
    .slice(0, 48);
  return `${panel.panelId}-${base || "panel"}-annotated`;
}
