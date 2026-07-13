import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { checkExternalProvider } from "@/services/external-monitor.service"
import { prisma } from "@/lib/prisma"

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await req.json().catch(() => ({}))
  const { websiteId, providerId } = body as { websiteId?: string; providerId?: string }

  if (!websiteId) {
    return NextResponse.json({ error: "websiteId required" }, { status: 400 })
  }

  const website = await prisma.website.findFirst({ where: { id: websiteId, userId: session.user.id } })
  if (!website) {
    return NextResponse.json({ error: "Website not found" }, { status: 404 })
  }

  const result = await checkExternalProvider(session.user.id, website.url, providerId)
  return NextResponse.json(result)
}
