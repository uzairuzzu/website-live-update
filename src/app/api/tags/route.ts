import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { getTags, createTag } from "@/services/tag.service"

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const tags = await getTags(session.user.id)
  return NextResponse.json(tags)
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { name, color } = await req.json()
  if (!name) return NextResponse.json({ error: "Name required" }, { status: 400 })
  const tag = await createTag(session.user.id, name, color || "#6366f1")
  return NextResponse.json(tag, { status: 201 })
}
