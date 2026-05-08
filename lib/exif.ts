import exifr from "exifr";
import { createHash } from "node:crypto";

/**
 * EXIF metadata surfaced from an uploaded image.
 *
 * Source-of-truth shape used by both the analyze pipeline and the
 * PanelAnalysis JSON. All fields are nullable: missing or unparseable
 * EXIF resolves to {@link EMPTY_EXIF}, never throws.
 */
export type ExifMeta = {
  /** Raw GPS coordinates in WGS84 decimal degrees if extractable. */
  lat: number | null;
  lon: number | null;
  altitudeM: number | null;
  /** Heading in degrees if drone shot recorded it. */
  headingDeg: number | null;
  /** When the photo was taken. ms since epoch. */
  takenAt: number | null;
  /** Camera/drone manufacturer + model if recorded. */
  make: string | null;
  model: string | null;
  /** Pixel dimensions from EXIF (sometimes differs from buffer when rotated). */
  exifWidth: number | null;
  exifHeight: number | null;
  /** Orientation tag (1..8). */
  orientation: number | null;
  /** Raw EXIF blob hash for audit (no PII concern — stable identifier only). */
  exifHash: string | null;
};

export const EMPTY_EXIF: ExifMeta = {
  lat: null,
  lon: null,
  altitudeM: null,
  headingDeg: null,
  takenAt: null,
  make: null,
  model: null,
  exifWidth: null,
  exifHeight: null,
  orientation: null,
  exifHash: null,
};

function num(v: unknown): number | null {
  if (typeof v !== "number") return null;
  if (!Number.isFinite(v)) return null;
  return v;
}

function str(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const trimmed = v.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function toMillis(v: unknown): number | null {
  if (v == null) return null;
  if (v instanceof Date) {
    const t = v.getTime();
    return Number.isFinite(t) ? t : null;
  }
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const t = Date.parse(v);
    return Number.isFinite(t) ? t : null;
  }
  return null;
}

/**
 * Parse EXIF metadata from an image buffer. Always resolves; corrupt or
 * missing EXIF returns {@link EMPTY_EXIF}.
 */
export async function readExif(buffer: Buffer): Promise<ExifMeta> {
  try {
    // exifr parses ifd0 by default (cannot be disabled). Explicitly opt in
    // to the segments we actually need.
    const raw = (await exifr.parse(buffer, {
      gps: true,
      exif: true,
      tiff: true,
    })) as Record<string, unknown> | undefined;

    if (!raw || typeof raw !== "object" || Object.keys(raw).length === 0) {
      return EMPTY_EXIF;
    }

    const lat = num(raw.latitude);
    const lon = num(raw.longitude);
    const altitudeM = num(raw.GPSAltitude);
    const headingDeg =
      num(raw.GPSImgDirection) ??
      num(raw.GPSTrack) ??
      num((raw as { gpsHeading?: unknown }).gpsHeading);
    const takenAt =
      toMillis(raw.DateTimeOriginal) ??
      toMillis(raw.CreateDate) ??
      toMillis(raw.ModifyDate);
    const make = str(raw.Make);
    const model = str(raw.Model);
    const exifWidth =
      num(raw.ExifImageWidth) ??
      num((raw as { ImageWidth?: unknown }).ImageWidth) ??
      num((raw as { PixelXDimension?: unknown }).PixelXDimension);
    const exifHeight =
      num(raw.ExifImageHeight) ??
      num((raw as { ImageHeight?: unknown }).ImageHeight) ??
      num((raw as { PixelYDimension?: unknown }).PixelYDimension);
    const orientation = num(raw.Orientation);

    let exifHash: string | null = null;
    try {
      const json = JSON.stringify(raw, (_k, v) =>
        typeof v === "bigint" ? v.toString() : v
      );
      if (json && json.length > 2) {
        exifHash = createHash("sha256").update(json).digest("hex").slice(0, 16);
      }
    } catch {
      exifHash = null;
    }

    return {
      lat,
      lon,
      altitudeM,
      headingDeg,
      takenAt,
      make,
      model,
      exifWidth,
      exifHeight,
      orientation,
      exifHash,
    };
  } catch {
    return EMPTY_EXIF;
  }
}
