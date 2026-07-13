import { prisma } from "@/lib/prisma"
import { getActiveMaintenanceMessage } from "@/services/maintenance.service"
import StatusPageClient from "./client"

export default async function StatusPage({ params }: { params: Promise<{ userId: string }> }) {
  const { userId } = await params
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { name: true, image: true } })
  if (!user) return <div className="flex items-center justify-center min-h-screen text-[var(--muted-foreground)]">Status page not found</div>

  const websites = await prisma.website.findMany({
    where: { userId },
    include: {
      tags: { include: { tag: true } },
      checks: { orderBy: { checkedAt: "desc" }, take: 1 },
      incidents: { where: { resolved: false }, orderBy: { startedAt: "desc" }, take: 5 },
      regionChecks: { orderBy: { checkedAt: "desc" }, take: 3 },
      ssl: { select: { valid: true, expiryDate: true } },
    },
  })

  const data = await Promise.all(websites.map(async (w) => {
    const maintenance = await getActiveMaintenanceMessage(w.id)
    const lastDay = new Date(new Date().getTime() - 86400000)
    const recentChecks = await prisma.websiteCheck.findMany({
      where: { websiteId: w.id, checkedAt: { gte: lastDay } },
      orderBy: { checkedAt: "asc" },
    })
    const total = recentChecks.length
    const online = recentChecks.filter(c => c.status === "online").length
    const uptime = total > 0 ? Math.round((online / total) * 100) : 100

    return {
      id: w.id, name: w.name, url: w.url, status: w.status,
      monitorType: w.monitorType,
      tags: w.tags.map(wt => ({ name: wt.tag.name, color: wt.tag.color })),
      lastCheck: w.checks[0] ? {
        statusCode: w.checks[0].statusCode,
        responseTime: w.checks[0].responseTime,
        checkedAt: w.checks[0].checkedAt.toISOString(),
      } : null,
      activeIncidents: w.incidents.map(i => ({
        id: i.id, startedAt: i.startedAt.toISOString(), severity: i.severity,
      })),
      regionChecks: w.regionChecks.map(r => ({
        region: r.region, status: r.status, responseTime: r.responseTime,
      })),
      maintenance,
      uptime24h: uptime,
      ssl: w.ssl ? { valid: w.ssl.valid, expiryDate: w.ssl.expiryDate.toISOString() } : null,
    }
  }))

  return <StatusPageClient userName={user.name || "Unknown"} userImage={user.image} websites={data} />
}
