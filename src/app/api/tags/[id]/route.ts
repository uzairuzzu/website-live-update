import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { updateTag, deleteTag } from "@/services/tag.service"

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { id } = await params
  const body = await req.json()
  const tag = await updateTag(id, body)
  return NextResponse.json(tag)
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { id } = await params
  await deleteTag(id)
  return NextResponse.json({ success: true })
}
