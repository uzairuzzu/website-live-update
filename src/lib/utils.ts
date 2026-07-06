import { type ClassValue, clsx } from "clsx"

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs)
}

export function formatDate(date: Date | string) {
  return new Intl.RelativeTimeFormat("en", { numeric: "auto" }).format(
    -Math.round((Date.now() - new Date(date).getTime()) / 60000),
    "minute"
  )
}

export function formatDateAbsolute(date: Date | string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date))
}

export function formatDuration(seconds: number | null) {
  if (!seconds) return "N/A"
  const hrs = Math.floor(seconds / 3600)
  const mins = Math.floor((seconds % 3600) / 60)
  if (hrs > 0) return `${hrs}h ${mins}m`
  return `${mins}m ${seconds % 60}s`
}

export function calculateUptime(
  checks: { status: string }[]
): number {
  if (checks.length === 0) return 100
  const online = checks.filter((c) => c.status === "online").length
  return Math.round((online / checks.length) * 10000) / 100
}
