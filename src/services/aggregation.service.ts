import { prisma } from "@/lib/prisma"

export async function aggregateDailyData(websiteId: string, date: Date) {
  const dayStart = new Date(date)
  dayStart.setHours(0, 0, 0, 0)
  const dayEnd = new Date(date)
  dayEnd.setHours(23, 59, 59, 999)

  const checks = await prisma.websiteCheck.findMany({
    where: { websiteId, checkedAt: { gte: dayStart, lte: dayEnd } },
  })

  const totalChecks = checks.length
  const onlineChecks = checks.filter(c => c.status === "online").length
  const responseTimes = checks.filter(c => c.responseTime && c.responseTime > 0).map(c => c.responseTime!)
  const avgResponseTime = responseTimes.length > 0 ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length : 0
  const minResponseTime = responseTimes.length > 0 ? Math.min(...responseTimes) : 0
  const maxResponseTime = responseTimes.length > 0 ? Math.max(...responseTimes) : 0
  const uptimePercent = totalChecks > 0 ? (onlineChecks / totalChecks) * 100 : 100

  const incidents = await prisma.incident.findMany({
    where: { websiteId, startedAt: { gte: dayStart, lte: dayEnd } },
  })
  const downtimeSeconds = incidents.reduce((sum, i) => sum + (i.duration || 0), 0)

  await prisma.dailyAggregation.upsert({
    where: { websiteId_date: { websiteId, date: dayStart } },
    update: {
      totalChecks, onlineChecks, avgResponseTime: Math.round(avgResponseTime),
      minResponseTime: Math.round(minResponseTime), maxResponseTime: Math.round(maxResponseTime),
      uptimePercent: Math.round(uptimePercent * 100) / 100, downtimeSeconds,
      incidentCount: incidents.length,
    },
    create: {
      websiteId, date: dayStart, totalChecks, onlineChecks,
      avgResponseTime: Math.round(avgResponseTime),
      minResponseTime: Math.round(minResponseTime), maxResponseTime: Math.round(maxResponseTime),
      uptimePercent: Math.round(uptimePercent * 100) / 100, downtimeSeconds,
      incidentCount: incidents.length,
    },
  })
}

export async function aggregateAllWebsites() {
  const websites = await prisma.website.findMany({ select: { id: true } })
  const yesterday = new Date(Date.now() - 86400000)
  for (const w of websites) {
    await aggregateDailyData(w.id, yesterday)
  }
}

export async function cleanOldChecks(daysToKeep: number = 30) {
  const cutoff = new Date(Date.now() - daysToKeep * 86400000)
  const result = await prisma.websiteCheck.deleteMany({
    where: { checkedAt: { lt: cutoff } },
  })
  return result.count
}

export async function getAggregations(websiteId: string, days: number = 30) {
  const since = new Date(Date.now() - days * 86400000)
  return prisma.dailyAggregation.findMany({
    where: { websiteId, date: { gte: since } },
    orderBy: { date: "asc" },
  })
}
