"use client"

import { useEffect, useState } from "react"
import { DashboardCard } from "@/components/cards/DashboardCard"
import { ResponseTimeChart } from "@/components/charts/ResponseTimeChart"
import { UptimeChart } from "@/components/charts/UptimeChart"
import { DowntimeBarChart } from "@/components/charts/DowntimeBarChart"
import { Card, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Globe, CheckCircle, XCircle, ShieldAlert, Gauge, Timer,
  TrendingUp, AlertTriangle, Zap, Shield, Activity,
} from "lucide-react"

interface Stats {
  totalWebsites: number
  online: number
  offline: number
  degraded: number
  averageResponseTime: number
  sslExpiring: number
  weakSsl: number
  uptime: number
  totalDowntime: number
  lastIncident: string | null
  anomalies: number
}

interface AnalyticsData {
  responseTimes: { date: string; time: number; website: string; isAnomaly?: boolean }[]
  uptimeData: { website: string; uptime: number; slaTarget?: number }[]
  dailyDowntime: { date: string; downtime: number }[]
}

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchData() {
      try {
        const [statsRes, analyticsRes] = await Promise.all([
          fetch("/api/analytics?type=dashboard"),
          fetch("/api/analytics"),
        ])
        const statsData = await statsRes.json()
        const analyticsData = await analyticsRes.json()
        setStats(statsData)
        setAnalytics(analyticsData)
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
    const interval = setInterval(fetchData, 30000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[var(--foreground)]">Dashboard</h1>
        <p className="text-sm text-[var(--muted-foreground)]">
          Overview of your monitored websites
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <DashboardCard
          title="Total Websites"
          value={stats?.totalWebsites ?? "—"}
          icon={Globe}
          loading={loading}
        />
        <DashboardCard
          title="Online"
          value={stats?.online ?? "—"}
          icon={CheckCircle}
          loading={loading}
        />
        <DashboardCard
          title="Offline"
          value={stats?.offline ?? "—"}
          icon={XCircle}
          loading={loading}
        />
        <DashboardCard
          title="SSL Expiring"
          value={stats?.sslExpiring ?? "—"}
          icon={ShieldAlert}
          loading={loading}
        />
        <DashboardCard
          title="Avg Response"
          value={stats?.averageResponseTime ? `${stats.averageResponseTime}ms` : "—"}
          icon={Gauge}
          loading={loading}
        />
        <DashboardCard
          title="Total Downtime"
          value={stats?.totalDowntime ? `${Math.round(stats.totalDowntime / 60)}m` : "0m"}
          icon={Timer}
          loading={loading}
        />
        <DashboardCard
          title="Uptime"
          value={stats?.uptime ? `${stats.uptime}%` : "—"}
          icon={TrendingUp}
          loading={loading}
        />
        <DashboardCard
          title="Anomalies"
          value={stats?.anomalies ?? "0"}
          icon={Zap}
          loading={loading}
        />
      </div>

      {(stats?.weakSsl ? stats.weakSsl > 0 : false) && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-amber-600">
              <Shield className="w-4 h-4" />
              Security Warnings
            </CardTitle>
          </CardHeader>
          <div className="px-5 pb-5">
            <p className="text-sm text-[var(--muted-foreground)]">
              {stats?.weakSsl} website(s) have weak SSL protocols or cipher suites detected.
            </p>
          </div>
        </Card>
      )}

      <div className="grid lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Response Time</CardTitle>
          </CardHeader>
          <ResponseTimeChart data={analytics?.responseTimes || []} />
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Uptime</CardTitle>
          </CardHeader>
          <UptimeChart
            data={
              analytics?.uptimeData.map((u) => ({
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
        <DowntimeBarChart data={analytics?.dailyDowntime || []} />
      </Card>
    </div>
  )
}
