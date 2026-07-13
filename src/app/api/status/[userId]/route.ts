import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getActiveMaintenanceMessage } from "@/services/maintenance.service"

export async function GET(req: Request, { params }: { params: Promise<{ userId: string }> }) {
  const { userId } = await params
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { name: true, image: true } })
  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const websites = await prisma.website.findMany({
    where: { userId },
    include: {
      tags: { include: { tag: true } },
      checks: { orderBy: { checkedAt: "desc" }, take: 1 },
      incidents: { where: { resolved: false }, orderBy: { startedAt: "desc" }, take: 5 },
    },
  })

  const data = await Promise.all(websites.map(async (w) => {
    const maintenance = await getActiveMaintenanceMessage(w.id)
    return {
      id: w.id, name: w.name, url: w.url, status: w.status,
      tags: w.tags.map(wt => ({ name: wt.tag.name, color: wt.tag.color })),
      lastCheck: w.checks[0] || null,
      activeIncidents: w.incidents,
      maintenance,
    }
  }))

  return NextResponse.json({ user: user.name || "Unknown", image: user.image, websites: data })
}
