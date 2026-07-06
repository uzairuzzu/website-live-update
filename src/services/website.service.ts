import { prisma } from "@/lib/prisma"

export async function getWebsites(userId: string) {
  return prisma.website.findMany({
    where: { userId },
    include: {
      checks: {
        orderBy: { checkedAt: "desc" },
        take: 1,
      },
      ssl: true,
      incidents: {
        where: { resolved: false },
        select: { id: true },
      },
    },
    orderBy: { createdAt: "desc" },
  })
}

export async function getWebsiteById(websiteId: string, userId: string) {
  return prisma.website.findFirst({
    where: { id: websiteId, userId },
    include: {
      checks: {
        orderBy: { checkedAt: "desc" },
        take: 20,
      },
      ssl: true,
      incidents: {
        orderBy: { startedAt: "desc" },
        take: 10,
      },
      _count: {
        select: { checks: true, incidents: true },
      },
    },
  })
}

export async function createWebsite(
  userId: string,
  data: { name: string; url: string; interval: number }
) {
  return prisma.website.create({
    data: {
      ...data,
      userId,
      status: "unknown",
    },
  })
}

export async function updateWebsite(
  websiteId: string,
  userId: string,
  data: { name?: string; url?: string; interval?: number }
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
