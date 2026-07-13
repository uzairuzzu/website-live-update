import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { getWebhooks, createWebhook } from "@/services/webhook.service"

export async function GET(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { searchParams } = new URL(req.url)
  const websiteId = searchParams.get("websiteId")
  if (!websiteId) return NextResponse.json({ error: "websiteId required" }, { status: 400 })
  const webhooks = await getWebhooks(websiteId)
  return NextResponse.json(webhooks)
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const body = await req.json()
  const { websiteId, name, url, type, events } = body
  if (!websiteId || !url) return NextResponse.json({ error: "websiteId and url required" }, { status: 400 })
  const webhook = await createWebhook({ websiteId, userId: session.user.id, name: name || "Default", url, type: type || "generic", events: events || "down,up" })
  return NextResponse.json(webhook, { status: 201 })
}
