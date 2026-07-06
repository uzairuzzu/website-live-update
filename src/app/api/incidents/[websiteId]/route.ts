import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { getIncidents } from "@/services/monitor.service"

export async function GET(
  req: Request,
  { params }: { params: Promise<{ websiteId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { websiteId } = await params
  const incidents = await getIncidents(websiteId)
  return NextResponse.json(incidents)
}
