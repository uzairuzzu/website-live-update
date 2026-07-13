import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET(
  req: Request,
  { params }: { params: Promise<{ websiteId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { websiteId } = await params
  const website = await prisma.website.findFirst({ where: { id: websiteId, userId: session.user.id } })
  if (!website) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const incidents = await prisma.incident.findMany({
    where: { websiteId },
    orderBy: { startedAt: "desc" },
    take: 20,
    include: { updates: { orderBy: { createdAt: "desc" } } },
  })

  return NextResponse.json(incidents)
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ websiteId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { websiteId } = await params
  const website = await prisma.website.findFirst({ where: { id: websiteId, userId: session.user.id } })
  if (!website) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const body = await req.json()
  const { incidentId, message, status } = body

  if (!incidentId || !message) {
    return NextResponse.json({ error: "incidentId and message required" }, { status: 400 })
  }

  const incident = await prisma.incident.findFirst({ where: { id: incidentId, websiteId } })
  if (!incident) return NextResponse.json({ error: "Incident not found" }, { status: 404 })

  const update = await prisma.incidentUpdate.create({
    data: { incidentId, message, status: status || null },
  })

  return NextResponse.json(update, { status: 201 })
}
