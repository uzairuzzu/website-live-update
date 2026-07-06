import { prisma } from "@/lib/prisma"

export async function getNotifications(userId: string) {
  const websites = await prisma.website.findMany({
    where: { userId },
    select: { id: true },
  })

  const websiteIds = websites.map((w) => w.id)

  return prisma.notification.findMany({
    where: { websiteId: { in: websiteIds } },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: {
      website: { select: { name: true, url: true } },
    },
  })
}

export async function getNotificationSettings(userId: string) {
  return prisma.notificationSetting.findMany({
    where: { userId },
  })
}

export async function updateNotificationSetting(
  userId: string,
  type: string,
  data: { enabled?: boolean; value?: string }
) {
  return prisma.notificationSetting.upsert({
    where: { userId_type: { userId, type } },
    update: data,
    create: {
      userId,
      type,
      enabled: data.enabled ?? true,
      value: data.value,
    },
  })
}

export async function createNotification(
  websiteId: string,
  type: string,
  message?: string
) {
  return prisma.notification.create({
    data: { websiteId, type, message },
  })
}

export async function markAsRead(notificationId: string) {
  return prisma.notification.update({
    where: { id: notificationId },
    data: { read: true },
  })
}

export async function getUnreadCount(userId: string) {
  const websites = await prisma.website.findMany({
    where: { userId },
    select: { id: true },
  })
  const websiteIds = websites.map((w) => w.id)

  return prisma.notification.count({
    where: { websiteId: { in: websiteIds }, read: false },
  })
}
