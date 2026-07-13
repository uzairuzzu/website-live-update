import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { getExternalProviders, createExternalProvider } from "@/services/external-monitor.service"

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const providers = await getExternalProviders(session.user.id)
  return NextResponse.json(providers)
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await req.json().catch(() => ({}))
  const { name, type, apiKey } = body as { name?: string; type?: string; apiKey?: string }

  if (!name || !type || !apiKey) {
    return NextResponse.json({ error: "name, type, and apiKey required" }, { status: 400 })
  }

  if (!["uptimerobot", "betterstack", "freshping"].includes(type)) {
    return NextResponse.json({ error: "Invalid type — use uptimerobot, betterstack, or freshping" }, { status: 400 })
  }

  const provider = await createExternalProvider(session.user.id, { name, type, apiKey })
  return NextResponse.json(provider)
}
