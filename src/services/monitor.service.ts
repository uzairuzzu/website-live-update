import { prisma } from "@/lib/prisma"

export async function getChecks(websiteId: string, limit = 50) {
  return prisma.websiteCheck.findMany({
    where: { websiteId },
    orderBy: { checkedAt: "desc" },
    take: limit,
  })
}

export async function getIncidents(websiteId: string) {
  return prisma.incident.findMany({
    where: { websiteId },
    orderBy: { startedAt: "desc" },
    take: 20,
  })
}

export async function getSSLInfo(websiteId: string) {
  return prisma.sSL.findUnique({ where: { websiteId } })
}

export async function getAnalytics(userId: string) {
  const websites = await prisma.website.findMany({
    where: { userId },
    include: {
      checks: {
        orderBy: { checkedAt: "desc" },
        take: 100,
      },
      incidents: {
        orderBy: { startedAt: "desc" },
        take: 50,
      },
    },
  })

  const responseTimes = websites.flatMap((w) =>
    w.checks
      .filter((c) => c.responseTime)
      .map((c) => ({
        date: c.checkedAt.toISOString(),
        time: c.responseTime!,
        website: w.name,
      }))
  )

  const uptimeData = websites.map((w) => {
    const total = w.checks.length
    const online = w.checks.filter((c) => c.status === "online").length
    return {
      website: w.name,
      uptime: total > 0 ? Math.round((online / total) * 10000) / 100 : 100,
    }
  })

  const dailyDowntime = aggregateDailyDowntime(
    websites.flatMap((w) => w.incidents)
  )

  return { responseTimes, uptimeData, dailyDowntime }
}

function aggregateDailyDowntime(
  incidents: { startedAt: Date; endedAt: Date | null; duration: number | null }[]
) {
  const daily: Record<string, number> = {}
  for (const inc of incidents) {
    if (inc.duration) {
      const day = inc.startedAt.toISOString().split("T")[0]
      daily[day] = (daily[day] || 0) + inc.duration
    }
  }
  return Object.entries(daily).map(([date, downtime]) => ({
    date,
    downtime: Math.round(downtime / 60),
  }))
}

export async function getDashboardStats(userId: string) {
  const websites = await prisma.website.findMany({
    where: { userId },
    include: {
      checks: {
        orderBy: { checkedAt: "desc" },
        take: 10,
      },
      ssl: true,
      incidents: {
        where: { resolved: false },
      },
    },
  })

  const totalWebsites = websites.length
  const online = websites.filter((w) => w.status === "online").length
  const offline = websites.filter((w) => w.status === "offline").length

  const allChecks = websites.flatMap((w) => w.checks)
  const avgResponse = allChecks.length
    ? Math.round(
        allChecks.reduce((sum, c) => sum + (c.responseTime || 0), 0) /
          allChecks.length
      )
    : 0

  const sslExpiring = websites.filter((w) => {
    if (!w.ssl) return false
    const daysLeft = Math.floor(
      (w.ssl.expiryDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    )
    return daysLeft < 30
  }).length

  const totalChecks = websites.flatMap((w) => w.checks)
  const uptime =
    totalChecks.length > 0
      ? Math.round(
          (totalChecks.filter((c) => c.status === "online").length /
            totalChecks.length) *
            10000
        ) / 100
      : 100

  const totalDowntime = websites
    .flatMap((w) =>
      w.incidents.filter((i) => i.duration != null).map((i) => i.duration!)
    )
    .reduce((a, b) => a + b, 0)

  const lastIncident = websites
    .flatMap((w) => w.incidents)
    .sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime())[0]

  return {
    totalWebsites,
    online,
    offline,
    averageResponseTime: avgResponse,
    sslExpiring,
    uptime,
    totalDowntime,
    lastIncident: lastIncident?.startedAt.toISOString() || null,
  }
}
