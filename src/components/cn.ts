import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Format a millisecond timing for panel display. -1 means the stage was skipped. */
export function ms(value: number | undefined): string {
  if (value === undefined || value === null) return "—";
  if (value < 0) return "—";
  if (value >= 1000) return `${(value / 1000).toFixed(2)}s`;
  return `${Math.round(value)}`;
}
