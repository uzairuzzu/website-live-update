import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { setWebsiteTags, getWebsiteTags } from "@/services/tag.service"

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { id } = await params
  const tags = await getWebsiteTags(id)
  return NextResponse.json(tags)
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { id } = await params
  const { tagIds } = await req.json()
  await setWebsiteTags(id, tagIds)
  return NextResponse.json({ success: true })
}
