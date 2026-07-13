import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { getMaintenanceWindows, createMaintenanceWindow } from "@/services/maintenance.service"

export async function GET(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { searchParams } = new URL(req.url)
  const websiteId = searchParams.get("websiteId")
  if (!websiteId) return NextResponse.json({ error: "websiteId required" }, { status: 400 })
  const windows = await getMaintenanceWindows(websiteId)
  return NextResponse.json(windows)
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { websiteId, startsAt, endsAt, message } = await req.json()
  if (!websiteId || !startsAt || !endsAt) {
    return NextResponse.json({ error: "websiteId, startsAt, endsAt required" }, { status: 400 })
  }
  const mw = await createMaintenanceWindow({ websiteId, startsAt, endsAt, message })
  return NextResponse.json(mw, { status: 201 })
}
