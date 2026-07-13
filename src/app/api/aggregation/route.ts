import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { aggregateAllWebsites, cleanOldChecks, getAggregations } from "@/services/aggregation.service"
import { prisma } from "@/lib/prisma"

export async function GET(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const websiteId = searchParams.get("websiteId")
  const days = parseInt(searchParams.get("days") || "30")

  if (websiteId) {
    const website = await prisma.website.findFirst({ where: { id: websiteId, userId: session.user.id } })
    if (!website) return NextResponse.json({ error: "Not found" }, { status: 404 })
    const aggs = await getAggregations(websiteId, days)
    return NextResponse.json(aggs)
  }

  return NextResponse.json({ message: "Use POST to trigger aggregation" })
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json().catch(() => ({}))

  if (body.action === "clean") {
    const daysToKeep = body.daysToKeep || 30
    const deleted = await cleanOldChecks(daysToKeep)
    return NextResponse.json({ deleted, message: `Cleaned ${deleted} old checks` })
  }

  await aggregateAllWebsites()
  return NextResponse.json({ success: true, message: "Aggregation complete" })
}
