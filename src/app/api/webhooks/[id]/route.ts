import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { updateWebhook, deleteWebhook } from "@/services/webhook.service"

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { id } = await params
  const body = await req.json()
  const webhook = await updateWebhook(id, body)
  return NextResponse.json(webhook)
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { id } = await params
  await deleteWebhook(id)
  return NextResponse.json({ success: true })
}
