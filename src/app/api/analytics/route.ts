import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { getAnalytics, getDashboardStats } from "@/services/monitor.service"

export async function GET(req: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const type = searchParams.get("type")

  if (type === "dashboard") {
    const stats = await getDashboardStats(session.user.id)
    return NextResponse.json(stats)
  }

  const analytics = await getAnalytics(session.user.id)
  return NextResponse.json(analytics)
}
