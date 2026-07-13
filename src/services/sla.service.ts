import { prisma } from "@/lib/prisma"

export interface SLAResult {
  websiteId: string
  name: string
  url: string
  period: string
  totalChecks: number
  onlineChecks: number
  uptime: number
  slaTarget: number
  slaMet: boolean
  totalDowntime: number
  incidentCount: number
  daily: { date: string; uptime: number }[]
}

export async function getSLAReport(userId: string, period: string = "30d", websiteId?: string): Promise<SLAResult[]> {
  const websites = websiteId
    ? await prisma.website.findMany({ where: { id: websiteId, userId } })
    : await prisma.website.findMany({ where: { userId } })

  const now = new Date()
  const periodMap: Record<string, number> = { "7d": 7, "30d": 30, "90d": 90, "12m": 365 }
  const days = periodMap[period] || 30
  const since = new Date(now.getTime() - days * 86400000)

  return Promise.all(websites.map(async (w) => {
    const checks = await prisma.websiteCheck.findMany({
      where: { websiteId: w.id, checkedAt: { gte: since } },
      orderBy: { checkedAt: "asc" },
    })
    const total = checks.length
    const online = checks.filter(c => c.status === "online").length
    const uptime = total > 0 ? (online / total) * 100 : 0

    const incidents = await prisma.incident.findMany({
      where: { websiteId: w.id, startedAt: { gte: since } },
    })
    const totalDowntime = incidents.reduce((sum, i) => sum + (i.duration || 0), 0)

    const daily: Record<string, { total: number; online: number }> = {}
    for (const c of checks) {
      const day = c.checkedAt.toISOString().slice(0, 10)
      if (!daily[day]) daily[day] = { total: 0, online: 0 }
      daily[day].total++
      if (c.status === "online") daily[day].online++
    }

    return {
      websiteId: w.id, name: w.name, url: w.url,
      period: `${days}d`, totalChecks: total, onlineChecks: online,
      uptime: Math.round(uptime * 100) / 100,
      slaTarget: w.slaTarget,
      slaMet: uptime >= w.slaTarget,
      totalDowntime, incidentCount: incidents.length,
      daily: Object.entries(daily).map(([date, d]) => ({
        date, uptime: Math.round((d.online / d.total) * 10000) / 100,
      })),
    }
  }))
}

export async function checkSLABreaches(userId: string): Promise<{ websiteId: string; name: string; uptime: number; target: number }[]> {
  const websites = await prisma.website.findMany({ where: { userId } })
  const breaches: { websiteId: string; name: string; uptime: number; target: number }[] = []

  for (const w of websites) {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000)
    const checks = await prisma.websiteCheck.findMany({
      where: { websiteId: w.id, checkedAt: { gte: since } },
    })
    const total = checks.length
    if (total < 10) continue
    const online = checks.filter(c => c.status === "online").length
    const uptime = (online / total) * 100
    if (uptime < w.slaTarget) {
      breaches.push({ websiteId: w.id, name: w.name, uptime: Math.round(uptime * 100) / 100, target: w.slaTarget })
    }
  }

  return breaches
}
