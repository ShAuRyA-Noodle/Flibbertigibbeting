import sharp from "sharp";
import type { BBox } from "./schema";

/**
 * Crop a normalized [ymin, xmin, ymax, xmax] (0-1) region out of `buffer`,
 * with a small expansion margin so we don't shave the panel frame.
 * Returns the JPEG buffer of the crop and its actual pixel rect.
 */
export async function cropFromBBox(
  buffer: Buffer,
  bbox: BBox,
  opts: { expandRatio?: number; maxWidth?: number; quality?: number } = {}
): Promise<{ buffer: Buffer; mimeType: string; width: number; height: number }> {
  const { expandRatio = 0.04, maxWidth = 1280, quality = 88 } = opts;

  const meta = await sharp(buffer).metadata();
  const W = meta.width ?? 0;
  const H = meta.height ?? 0;
  if (W === 0 || H === 0) throw new Error("Source image has no dimensions");

  let [ymin, xmin, ymax, xmax] = bbox;
  // expand
  const dy = (ymax - ymin) * expandRatio;
  const dx = (xmax - xmin) * expandRatio;
  ymin = Math.max(0, ymin - dy);
  xmin = Math.max(0, xmin - dx);
  ymax = Math.min(1, ymax + dy);
  xmax = Math.min(1, xmax + dx);

  const left = Math.round(xmin * W);
  const top = Math.round(ymin * H);
  const width = Math.max(1, Math.round((xmax - xmin) * W));
  const height = Math.max(1, Math.round((ymax - ymin) * H));

  let pipeline = sharp(buffer).extract({ left, top, width, height });
  if (width > maxWidth) {
    pipeline = pipeline.resize({ width: maxWidth, withoutEnlargement: true });
  }
  const out = await pipeline.jpeg({ quality, mozjpeg: true }).toBuffer({ resolveWithObject: true });

  return {
    buffer: out.data,
    mimeType: "image/jpeg",
    width: out.info.width,
    height: out.info.height,
  };
}

export function bufferToDataUrl(buffer: Buffer, mimeType = "image/jpeg"): string {
  return `data:${mimeType};base64,${buffer.toString("base64")}`;
}

/**
 * Resize a possibly-huge upload to a sensible analysis size (keeps original aspect),
 * for both the detection preflight and per-panel calls. Saves tokens + time.
 */
export async function normalizeUpload(
  buffer: Buffer,
  mimeType: string,
  opts: { maxLongEdge?: number; quality?: number } = {}
): Promise<{ buffer: Buffer; mimeType: string; width: number; height: number }> {
  const { maxLongEdge = 1600, quality = 90 } = opts;
  const meta = await sharp(buffer).metadata();
  const W = meta.width ?? 0;
  const H = meta.height ?? 0;
  const long = Math.max(W, H);
  let pipe = sharp(buffer).rotate(); // honor EXIF orientation
  if (long > maxLongEdge) {
    pipe = pipe.resize({ width: W >= H ? maxLongEdge : undefined, height: H > W ? maxLongEdge : undefined, withoutEnlargement: true });
  }
  // re-encode to JPEG for consistent downstream handling unless input is small PNG with alpha
  const out = await pipe.jpeg({ quality, mozjpeg: true }).toBuffer({ resolveWithObject: true });
  return { buffer: out.data, mimeType: "image/jpeg", width: out.info.width, height: out.info.height };
}
