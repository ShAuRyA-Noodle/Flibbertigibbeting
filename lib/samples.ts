export type Sample = {
  id: string;
  file: string;     // relative path under /public
  name: string;     // display title
  hint: string;     // what to expect from analysis
  tag: string;      // short pill label
};

/**
 * Bundled sample images stored under /public/samples.
 * All images are real photographs of solar panels (sourced from Unsplash, free license).
 * Analysis output reflects what Gemini actually sees, not pre-canned text.
 */
export const SAMPLES: Sample[] = [
  {
    id: "01",
    file: "/samples/sample-01.webp",
    name: "Rooftop array",
    hint: "Standard angle on a clean rooftop install. Baseline condition reference.",
    tag: "BASELINE",
  },
  {
    id: "02",
    file: "/samples/sample-02.webp",
    name: "Close-up module",
    hint: "Tight crop on cell-grid detail. Tests fine-grained defect surfacing.",
    tag: "CELL DETAIL",
  },
  {
    id: "03",
    file: "/samples/sample-03.webp",
    name: "Field row",
    hint: "Ground-mount installation row. Watch shading and frame mounting calls.",
    tag: "FIELD",
  },
  {
    id: "04",
    file: "/samples/sample-04.webp",
    name: "Aerial array",
    hint: "Drone-style wider shot. Triggers multi-panel detection + per-module split.",
    tag: "MULTI-PANEL",
  },
  {
    id: "05",
    file: "/samples/sample-05.webp",
    name: "Service inspection",
    hint: "Panel under maintenance. Surface conditions vary, useful for cleanliness scoring.",
    tag: "SERVICE",
  },
  {
    id: "06",
    file: "/samples/sample-06.webp",
    name: "Residential single",
    hint: "Single residential module. Clean comparison anchor for the rest.",
    tag: "RESIDENTIAL",
  },
];

export const SAMPLE_BY_ID = Object.fromEntries(SAMPLES.map((s) => [s.id, s]));

/**
 * Fetch a sample image and convert it to a real File object that the upload
 * pipeline accepts. Browser only.
 */
export async function loadSampleAsFile(s: Sample): Promise<File> {
  const res = await fetch(s.file);
  if (!res.ok) throw new Error(`Failed to load sample ${s.id}: ${res.status}`);
  const blob = await res.blob();
  const fileName = `solpop-${s.id}-${s.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.webp`;
  return new File([blob], fileName, { type: "image/webp", lastModified: Date.now() });
}

export async function loadSamplesByIds(ids: string[]): Promise<File[]> {
  const list = ids.map((id) => SAMPLE_BY_ID[id]).filter(Boolean);
  return Promise.all(list.map(loadSampleAsFile));
}
