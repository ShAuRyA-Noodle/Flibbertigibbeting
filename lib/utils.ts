import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatPct(n: number) {
  return `${Math.round(n * 100) / 100}%`;
}

export function severityColor(s: "low" | "medium" | "high" | "critical") {
  return {
    low: "var(--sev-low)",
    medium: "var(--sev-medium)",
    high: "var(--sev-high)",
    critical: "var(--sev-critical)",
  }[s];
}

export function uid() {
  // Use crypto.randomUUID() so client-side IDs are not predictable.
  return (typeof crypto !== "undefined" && crypto.randomUUID)
    ? crypto.randomUUID().slice(0, 8)
    : Date.now().toString(36).slice(-8);
}
