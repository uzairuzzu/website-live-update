"use client"

import { useEffect, useState } from "react"
import { Card, CardHeader, CardTitle } from "@/components/ui/card"
import { ResponseTimeChart } from "@/components/charts/ResponseTimeChart"
import { UptimeChart } from "@/components/charts/UptimeChart"
import { DowntimeBarChart } from "@/components/charts/DowntimeBarChart"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Download, Target, AlertTriangle, BarChart3, TrendingUp } from "lucide-react"

interface AnalyticsData {
  responseTimes: { date: string; time: number; website: string; isAnomaly?: boolean }[]
  uptimeData: { website: string; uptime: number; slaTarget?: number }[]
  dailyDowntime: { date: string; downtime: number }[]
}

interface SLAData {
  period: string
  websites: {
    websiteId: string; name: string; uptime: number; slaTarget: number; slaMet: boolean
    totalChecks: number; incidentCount: number; totalDowntime: number
    daily: { date: string; uptime: number }[]
  }[]
}

interface TrafficData {
  websiteId: string
  name: string
  trafficScore: number
  trafficLevel: string
  estimatedDailyVisits: string
  confidence: string
}

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [sla, setSla] = useState<SLAData | null>(null)
  const [traffic, setTraffic] = useState<TrafficData[]>([])
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState("30d")

  useEffect(() => {
    Promise.all([
      fetch("/api/analytics").then(r => r.json()),
      fetch(`/api/sla?period=${period}`).then(r => r.json()),
    ])
      .then(([analytics, slaData]) => {
        setData(analytics)
        setSla(slaData)
        if (analytics?.uptimeData?.length > 0) {
          const websiteIds = analytics.uptimeData.map((u: any) => u.websiteId).filter(Boolean)
          if (websiteIds.length > 0) {
            Promise.all(
              analytics.uptimeData.map((u: any) =>
                u.websiteId ? fetch(`/api/traffic?websiteId=${u.websiteId}`).then(r => r.json()).then(d => ({
                  websiteId: u.websiteId,
                  name: u.website,
                  trafficScore: d.trafficScore || 0,
                  trafficLevel: d.trafficLevel || "unknown",
                  estimatedDailyVisits: d.estimatedDailyVisits || "N/A",
                  confidence: d.confidence || "low",
                })).catch(() => null) : Promise.resolve(null)
              )
            ).then(results => setTraffic(results.filter(Boolean) as TrafficData[]))
          }
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [period])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--foreground)]">Analytics</h1>
          <p className="text-sm text-[var(--muted-foreground)]">Detailed performance metrics</p>
        </div>
        <div className="flex items-center gap-2">
          <select value={period} onChange={e => setPeriod(e.target.value)}
            className="rounded-lg border border-[var(--input)] bg-[var(--background)] px-3 py-1.5 text-sm">
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
          </select>
          <Button variant="secondary"><Download className="w-4 h-4 mr-1.5" />Export</Button>
        </div>
      </div>

      {traffic.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><BarChart3 className="w-4 h-4" />Traffic Overview</CardTitle>
          </CardHeader>
          <div className="px-5 pb-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {traffic.map(t => {
                const scoreColor = t.trafficScore >= 70 ? "text-emerald-500" : t.trafficScore >= 40 ? "text-amber-500" : "text-red-500"
                const scoreBg = t.trafficScore >= 70 ? "bg-emerald-500" : t.trafficScore >= 40 ? "bg-amber-500" : "bg-red-500"
                const levelLabel: Record<string, string> = { very_low: "Very Low", low: "Low", medium: "Medium", high: "High", very_high: "Very High" }
                return (
                  <div key={t.websiteId} className="p-3 rounded-lg bg-[var(--secondary)]">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-[var(--foreground)]">{t.name}</span>
                      <Badge variant={t.trafficScore >= 60 ? "online" : t.trafficScore >= 30 ? "warning" : "offline"}>
                        {levelLabel[t.trafficLevel] || t.trafficLevel}
                      </Badge>
                    </div>
                    <div className="flex items-end gap-3">
                      <div>
                        <div className={`text-xl font-bold ${scoreColor}`}>{t.trafficScore}</div>
                        <div className="text-[10px] text-[var(--muted-foreground)]">Score</div>
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-[var(--foreground)]">{t.estimatedDailyVisits}</div>
                        <div className="text-[10px] text-[var(--muted-foreground)]">Est. visits/day</div>
                      </div>
                    </div>
                    <div className="w-full h-1.5 bg-[var(--background)] rounded-full mt-2 overflow-hidden">
                      <div className={`h-full ${scoreBg} rounded-full`} style={{ width: `${t.trafficScore}%` }} />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </Card>
      )}

      <div className="grid lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle>Response Time</CardTitle></CardHeader>
          <ResponseTimeChart data={data?.responseTimes || []} />
        </Card>
        <Card>
          <CardHeader><CardTitle>Uptime</CardTitle></CardHeader>
          <UptimeChart data={data?.uptimeData.map(u => ({ date: u.website, uptime: u.uptime })) || []} />
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Daily Downtime</CardTitle></CardHeader>
        <DowntimeBarChart data={data?.dailyDowntime || []} />
      </Card>

      {/* SLA Compliance */}
      {sla?.websites && sla.websites.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Target className="w-4 h-4" />SLA Compliance</CardTitle>
          </CardHeader>
          <div className="space-y-3 px-5 pb-5">
            {sla.websites.map(w => (
              <div key={w.websiteId} className="p-4 rounded-lg bg-[var(--secondary)]">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-[var(--foreground)]">{w.name}</span>
                  <span className={`text-sm font-bold ${w.slaMet ? "text-green-600" : "text-red-600"}`}>
                    {w.uptime}% / {w.slaTarget}% target
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-2 rounded-full bg-[var(--muted)] overflow-hidden">
                    <div className={`h-full rounded-full ${w.slaMet ? "bg-green-500" : "bg-red-500"}`}
                      style={{ width: `${Math.min(w.uptime, 100)}%` }} />
                  </div>
                  {!w.slaMet && (
                    <span className="flex items-center gap-1 text-xs text-red-600">
                      <AlertTriangle className="w-3 h-3" />Breached
                    </span>
                  )}
                </div>
                {w.daily.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {w.daily.map(d => (
                      <div key={d.date} className={`w-2.5 h-2.5 rounded-sm ${d.uptime >= w.slaTarget ? "bg-green-500" : d.uptime >= 99 ? "bg-yellow-500" : "bg-red-500"}`}
                        title={`${d.date}: ${d.uptime}%`} />
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}

      <div className="grid lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle>Monthly Report</CardTitle></CardHeader>
          <div className="space-y-3">
            {data?.uptimeData.map((u) => (
              <div key={u.website} className="flex items-center justify-between p-3 rounded-lg bg-[var(--secondary)]">
                <span className="text-sm font-medium text-[var(--foreground)]">{u.website}</span>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-[var(--muted-foreground)]">{u.uptime}% uptime</span>
                  {u.slaTarget && <span className={`text-xs px-1.5 py-0.5 rounded ${u.uptime >= u.slaTarget ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>SLA</span>}
                </div>
              </div>
            ))}
            {(!data?.uptimeData || data.uptimeData.length === 0) && (
              <p className="text-sm text-[var(--muted-foreground)] text-center py-6">No data available</p>
            )}
          </div>
        </Card>
        <Card>
          <CardHeader><CardTitle>Status Timeline</CardTitle></CardHeader>
          <div className="space-y-3">
            {data?.dailyDowntime.slice(0, 10).map((d) => (
              <div key={d.date} className="flex items-center justify-between p-3 rounded-lg bg-[var(--secondary)]">
                <span className="text-sm text-[var(--foreground)]">{d.date}</span>
                <span className="text-sm text-[var(--muted-foreground)]">{d.downtime}m downtime</span>
              </div>
            ))}
            {(!data?.dailyDowntime || data.dailyDowntime.length === 0) && (
              <p className="text-sm text-[var(--muted-foreground)] text-center py-6">No downtime recorded</p>
            )}
          </div>
        </Card>
      </div>
    </div>
  )
}
