import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET(req: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const url = new URL(req.url)
  const websiteId = url.searchParams.get("websiteId")
  if (!websiteId) {
    return NextResponse.json({ error: "websiteId required" }, { status: 400 })
  }

  const website = await prisma.website.findFirst({ where: { id: websiteId, userId: session.user.id } })
  if (!website) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  const days: { date: string; uptime: number; totalChecks: number; onlineChecks: number }[] = []
  const now = new Date()

  for (let i = 29; i >= 0; i--) {
    const dayStart = new Date(now)
    dayStart.setDate(dayStart.getDate() - i)
    dayStart.setHours(0, 0, 0, 0)
    const dayEnd = new Date(dayStart)
    dayEnd.setHours(23, 59, 59, 999)

    const checks = await prisma.websiteCheck.findMany({
      where: { websiteId, checkedAt: { gte: dayStart, lte: dayEnd } },
      select: { status: true },
    })

    const total = checks.length
    const online = checks.filter(c => c.status === "online").length
    const uptime = total > 0 ? (online / total) * 100 : 100

    days.push({
      date: dayStart.toISOString().split("T")[0],
      uptime: Math.round(uptime * 100) / 100,
      totalChecks: total,
      onlineChecks: online,
    })
  }

  return NextResponse.json({ days })
}
