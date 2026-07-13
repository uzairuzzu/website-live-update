import { prisma } from "@/lib/prisma"

export async function getWebsites(userId: string) {
  return prisma.website.findMany({
    where: { userId },
    include: {
      checks: { orderBy: { checkedAt: "desc" }, take: 1 },
      ssl: true,
      incidents: { where: { resolved: false }, select: { id: true } },
      baseline: true,
    },
    orderBy: { createdAt: "desc" },
  })
}

export async function getWebsiteById(websiteId: string, userId: string) {
  return prisma.website.findFirst({
    where: { id: websiteId, userId },
    include: {
      checks: { orderBy: { checkedAt: "desc" }, take: 20 },
      ssl: true,
      domain: true,
      baseline: true,
      incidents: {
        orderBy: { startedAt: "desc" },
        take: 10,
        include: { updates: { orderBy: { createdAt: "desc" } } },
      },
      regionChecks: { orderBy: { checkedAt: "desc" }, take: 15 },
      aggregations: { orderBy: { date: "desc" }, take: 30 },
      _count: { select: { checks: true, incidents: true } },
    },
  })
}

export async function createWebsite(
  userId: string,
  data: { name: string; url: string; interval: number; monitorType?: string; slaTarget?: number; sensitivity?: string }
) {
  return prisma.website.create({
    data: {
      name: data.name,
      url: data.url,
      interval: data.interval,
      monitorType: data.monitorType || "http",
      slaTarget: data.slaTarget || 99.9,
      sensitivity: data.sensitivity || "normal",
      userId,
      status: "unknown",
    },
  })
}

export async function updateWebsite(
  websiteId: string,
  userId: string,
  data: { name?: string; url?: string; interval?: number; monitorType?: string; slaTarget?: number; sensitivity?: string }
) {
  const website = await prisma.website.findFirst({
    where: { id: websiteId, userId },
  })
  if (!website) return null
  return prisma.website.update({
    where: { id: websiteId },
    data,
  })
}

export async function deleteWebsite(websiteId: string, userId: string) {
  const website = await prisma.website.findFirst({
    where: { id: websiteId, userId },
  })
  if (!website) return null
  return prisma.website.delete({ where: { id: websiteId } })
}
