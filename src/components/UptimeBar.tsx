"use client"

interface UptimeBarProps {
  websiteId: string
}

interface DayData {
  date: string
  uptime: number
  totalChecks: number
  onlineChecks: number
}

import { useEffect, useState } from "react"

export function UptimeBar({ websiteId }: UptimeBarProps) {
  const [days, setDays] = useState<DayData[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/uptime-bar?websiteId=${websiteId}`)
      .then(r => r.json())
      .then(d => setDays(d.days || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [websiteId])

  if (loading) return <div className="h-8 bg-[var(--secondary)] rounded animate-pulse" />
  if (days.length === 0) return null

  const getColor = (uptime: number) => {
    if (uptime >= 99.9) return "bg-emerald-500"
    if (uptime >= 99) return "bg-emerald-400"
    if (uptime >= 95) return "bg-yellow-500"
    if (uptime >= 90) return "bg-orange-500"
    return "bg-red-500"
  }

  const totalUptime = days.reduce((s, d) => s + d.uptime, 0) / days.length

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-medium text-[var(--foreground)]">Uptime — Last {days.length} days</span>
        <span className={`text-xs font-bold ${totalUptime >= 99.9 ? "text-emerald-500" : totalUptime >= 95 ? "text-yellow-500" : "text-red-500"}`}>
          {totalUptime.toFixed(2)}%
        </span>
      </div>
      <div className="flex gap-[2px]">
        {days.map((d, i) => (
          <div
            key={i}
            className={`flex-1 h-7 rounded-sm ${getColor(d.uptime)} cursor-pointer transition-opacity hover:opacity-80 relative group`}
            title={`${d.date}: ${d.uptime.toFixed(2)}% (${d.onlineChecks}/${d.totalChecks} checks)`}
          >
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 bg-[var(--popover)] text-[var(--popover-foreground)] text-[10px] rounded shadow-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
              {d.date}: {d.uptime.toFixed(2)}%
            </div>
          </div>
        ))}
      </div>
      <div className="flex items-center justify-end gap-3 mt-1">
        <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-sm bg-emerald-500" /><span className="text-[10px] text-[var(--muted-foreground)]">99.9%+</span></div>
        <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-sm bg-yellow-500" /><span className="text-[10px] text-[var(--muted-foreground)]">95-99%</span></div>
        <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-sm bg-red-500" /><span className="text-[10px] text-[var(--muted-foreground)]">&lt;95%</span></div>
      </div>
    </div>
  )
}
