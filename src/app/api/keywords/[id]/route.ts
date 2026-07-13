import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { updateKeyword, deleteKeyword } from "@/services/keyword.service"

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { id } = await params
  const body = await req.json()
  const kw = await updateKeyword(id, body)
  return NextResponse.json(kw)
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { id } = await params
  await deleteKeyword(id)
  return NextResponse.json({ success: true })
}
