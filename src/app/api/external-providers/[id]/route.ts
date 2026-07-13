import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { updateExternalProvider, deleteExternalProvider } from "@/services/external-monitor.service"

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { id } = await params
  const body = await req.json().catch(() => ({}))
  await updateExternalProvider(session.user.id, id, body)
  return NextResponse.json({ success: true })
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { id } = await params
  await deleteExternalProvider(session.user.id, id)
  return NextResponse.json({ success: true })
}
