import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { searchParams } = new URL(req.url)
  const websiteId = searchParams.get("websiteId")
  const period = searchParams.get("period") || "30d"

  const websites = websiteId
    ? await prisma.website.findMany({ where: { id: websiteId, userId: session.user.id } })
    : await prisma.website.findMany({ where: { userId: session.user.id } })

  const now = new Date()
  const periodMap: Record<string, number> = { "7d": 7, "30d": 30, "90d": 90, "12m": 365 }
  const days = periodMap[period] || 30
  const since = new Date(now.getTime() - days * 86400000)

  const results = await Promise.all(websites.map(async (w) => {
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

    // Daily breakdown
    const daily: Record<string, { total: number; online: number }> = {}
    for (const c of checks) {
      const day = c.checkedAt.toISOString().slice(0, 10)
      if (!daily[day]) daily[day] = { total: 0, online: 0 }
      daily[day].total++
      if (c.status === "online") daily[day].online++
    }

    return {
      id: w.id, name: w.name, url: w.url,
      period: `${days}d`, totalChecks: total, onlineChecks: online,
      uptime: Math.round(uptime * 100) / 100,
      totalDowntime, incidentCount: incidents.length,
      daily: Object.entries(daily).map(([date, d]) => ({
        date, uptime: Math.round((d.online / d.total) * 10000) / 100,
      })),
    }
  }))

  return NextResponse.json({ period: `${days}d`, since: since.toISOString(), websites: results })
}
