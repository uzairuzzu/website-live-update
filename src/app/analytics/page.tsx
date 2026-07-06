"use client"

import { useEffect, useState } from "react"
import { Card, CardHeader, CardTitle } from "@/components/ui/card"
import { ResponseTimeChart } from "@/components/charts/ResponseTimeChart"
import { UptimeChart } from "@/components/charts/UptimeChart"
import { DowntimeBarChart } from "@/components/charts/DowntimeBarChart"
import { Button } from "@/components/ui/button"
import { Download } from "lucide-react"

interface AnalyticsData {
  responseTimes: { date: string; time: number; website: string }[]
  uptimeData: { website: string; uptime: number }[]
  dailyDowntime: { date: string; downtime: number }[]
}

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch("/api/analytics")
      .then((res) => res.json())
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--foreground)]">
            Analytics
          </h1>
          <p className="text-sm text-[var(--muted-foreground)]">
            Detailed performance metrics
          </p>
        </div>
        <Button variant="secondary">
          <Download className="w-4 h-4 mr-1.5" />
          Export Report
        </Button>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Response Time</CardTitle>
          </CardHeader>
          <ResponseTimeChart data={data?.responseTimes || []} />
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Uptime</CardTitle>
          </CardHeader>
          <UptimeChart
            data={
              data?.uptimeData.map((u) => ({
                date: u.website,
                uptime: u.uptime,
              })) || []
            }
          />
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Daily Downtime</CardTitle>
        </CardHeader>
        <DowntimeBarChart data={data?.dailyDowntime || []} />
      </Card>

      <div className="grid lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Monthly Report</CardTitle>
          </CardHeader>
          <div className="space-y-3">
            {data?.uptimeData.map((u) => (
              <div
                key={u.website}
                className="flex items-center justify-between p-3 rounded-lg bg-[var(--secondary)]"
              >
                <span className="text-sm font-medium text-[var(--foreground)]">
                  {u.website}
                </span>
                <span className="text-sm text-[var(--muted-foreground)]">
                  {u.uptime}% uptime
                </span>
              </div>
            ))}
            {(!data?.uptimeData || data.uptimeData.length === 0) && (
              <p className="text-sm text-[var(--muted-foreground)] text-center py-6">
                No data available
              </p>
            )}
          </div>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Status Timeline</CardTitle>
          </CardHeader>
          <div className="space-y-3">
            {data?.dailyDowntime.slice(0, 10).map((d) => (
              <div
                key={d.date}
                className="flex items-center justify-between p-3 rounded-lg bg-[var(--secondary)]"
              >
                <span className="text-sm text-[var(--foreground)]">
                  {d.date}
                </span>
                <span className="text-sm text-[var(--muted-foreground)]">
                  {d.downtime}m downtime
                </span>
              </div>
            ))}
            {(!data?.dailyDowntime || data.dailyDowntime.length === 0) && (
              <p className="text-sm text-[var(--muted-foreground)] text-center py-6">
                No downtime recorded
              </p>
            )}
          </div>
        </Card>
      </div>
    </div>
  )
}
