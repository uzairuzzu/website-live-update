import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { checkDomainInfo, getDomainInfo } from "@/services/domain.service"
import { prisma } from "@/lib/prisma"

export async function GET(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const websiteId = searchParams.get("websiteId")
  if (!websiteId) return NextResponse.json({ error: "websiteId required" }, { status: 400 })

  const website = await prisma.website.findFirst({ where: { id: websiteId, userId: session.user.id } })
  if (!website) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const existing = await getDomainInfo(websiteId)
  if (existing) {
    const hoursSinceCheck = (Date.now() - existing.checkedAt.getTime()) / (1000 * 60 * 60)
    if (hoursSinceCheck < 24) {
      return NextResponse.json(existing)
    }
  }

  const result = await checkDomainInfo(websiteId)
  return NextResponse.json(result)
}
