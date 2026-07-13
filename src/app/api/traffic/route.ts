import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { getTrafficEstimate } from "@/services/traffic.service"
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
    return NextResponse.json({ error: "Website not found" }, { status: 404 })
  }

  const estimate = await getTrafficEstimate(websiteId)
  return NextResponse.json(estimate)
}
