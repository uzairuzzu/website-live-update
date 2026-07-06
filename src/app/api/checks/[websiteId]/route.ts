import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { getChecks } from "@/services/monitor.service"
import { performCheck } from "@/lib/monitor"

export async function GET(
  req: Request,
  { params }: { params: Promise<{ websiteId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { websiteId } = await params
  const checks = await getChecks(websiteId)
  return NextResponse.json(checks)
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ websiteId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { websiteId } = await params
  const result = await performCheck(websiteId)
  return NextResponse.json(result)
}
