import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { getSLAReport, checkSLABreaches } from "@/services/sla.service"

export async function GET(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const websiteId = searchParams.get("websiteId") || undefined
  const period = searchParams.get("period") || "30d"
  const type = searchParams.get("type")

  if (type === "breaches") {
    const breaches = await checkSLABreaches(session.user.id)
    return NextResponse.json({ breaches })
  }

  const report = await getSLAReport(session.user.id, period, websiteId)
  return NextResponse.json({ period, websites: report })
}
