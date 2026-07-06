import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { performCheck, checkSSL } from "@/lib/monitor"
import { prisma } from "@/lib/prisma"

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { websiteId } = await req.json()

  if (websiteId) {
    const check = await performCheck(websiteId)
    await checkSSL(websiteId).catch(() => {})
    return NextResponse.json({ checked: true, result: check })
  }

  const websites = await prisma.website.findMany({
    where: { userId: session.user.id },
  })

  const results = []
  for (const website of websites) {
    const check = await performCheck(website.id)
    await checkSSL(website.id).catch(() => {})
    results.push({ id: website.id, name: website.name, result: check })
  }

  return NextResponse.json({ checked: results.length, results })
}
