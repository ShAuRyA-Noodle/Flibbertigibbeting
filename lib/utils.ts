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
  return Math.random().toString(36).slice(2, 10);
}
