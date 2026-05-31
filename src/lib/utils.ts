import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatNumber(n: number, digits = 0): string {
  return n.toLocaleString("en-EG", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export function pct(n: number, digits = 1): string {
  return `${n.toFixed(digits)}%`;
}
