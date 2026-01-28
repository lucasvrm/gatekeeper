import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getRepoNameFromPath(path: string): string {
  if (!path || path.trim() === "") {
    return "unknown"
  }
  // Handle both Unix and Windows paths
  const normalized = path.replace(/\\/g, "/")
  const segments = normalized.split("/").filter(Boolean)
  return segments[segments.length - 1] || "unknown"
}
