import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { checkDNSPropagation } from "@/services/dns-propagation.service"
import { prisma } from "@/lib/prisma"

export async function GET(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const websiteId = searchParams.get("websiteId")
  const hostname = searchParams.get("hostname")

  let targetHostname = hostname

  if (!targetHostname && websiteId) {
    const website = await prisma.website.findFirst({ where: { id: websiteId, userId: session.user.id } })
    if (!website) return NextResponse.json({ error: "Website not found" }, { status: 404 })
    try {
      targetHostname = new URL(website.url).hostname
    } catch {
      return NextResponse.json({ error: "Invalid URL" }, { status: 400 })
    }
  }

  if (!targetHostname) {
    return NextResponse.json({ error: "hostname or websiteId required" }, { status: 400 })
  }

  const result = await checkDNSPropagation(targetHostname)
  return NextResponse.json(result)
}
