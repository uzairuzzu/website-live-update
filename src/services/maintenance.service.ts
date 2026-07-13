import { prisma } from "@/lib/prisma"

export async function getMaintenanceWindows(websiteId: string) {
  return prisma.maintenanceWindow.findMany({
    where: { websiteId }, orderBy: { startsAt: "desc" },
  })
}

export async function createMaintenanceWindow(data: {
  websiteId: string; startsAt: string; endsAt: string; message?: string
}) {
  return prisma.maintenanceWindow.create({
    data: {
      websiteId: data.websiteId, message: data.message,
      startsAt: new Date(data.startsAt), endsAt: new Date(data.endsAt),
    },
  })
}

export async function deleteMaintenanceWindow(id: string) {
  return prisma.maintenanceWindow.delete({ where: { id } })
}

export async function isInMaintenance(websiteId: string): Promise<boolean> {
  const now = new Date()
  const active = await prisma.maintenanceWindow.findFirst({
    where: { websiteId, startsAt: { lte: now }, endsAt: { gte: now } },
  })
  return !!active
}

export async function getActiveMaintenanceMessage(websiteId: string): Promise<string | null> {
  const now = new Date()
  const active = await prisma.maintenanceWindow.findFirst({
    where: { websiteId, startsAt: { lte: now }, endsAt: { gte: now } },
  })
  return active?.message || null
}
