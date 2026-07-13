import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { getKeywords, createKeyword } from "@/services/keyword.service"

export async function GET(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { searchParams } = new URL(req.url)
  const websiteId = searchParams.get("websiteId")
  if (!websiteId) return NextResponse.json({ error: "websiteId required" }, { status: 400 })
  const keywords = await getKeywords(websiteId)
  return NextResponse.json(keywords)
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { websiteId, keyword, mode, enabled } = await req.json()
  if (!websiteId || !keyword) return NextResponse.json({ error: "websiteId and keyword required" }, { status: 400 })
  const kw = await createKeyword({ websiteId, keyword, mode: mode || "present", enabled })
  return NextResponse.json(kw, { status: 201 })
}
