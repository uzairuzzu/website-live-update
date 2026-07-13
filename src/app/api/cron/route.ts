import { NextResponse } from "next/server"
import { checkAllWebsites } from "@/lib/monitor"
import { aggregateAllWebsites } from "@/services/aggregation.service"

export const dynamic = "force-dynamic"
export const maxDuration = 300

const CRON_SECRET = process.env.CRON_SECRET
let lastRun = 0
const MIN_INTERVAL = 60000

export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization")
  if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const now = Date.now()
  if (now - lastRun < MIN_INTERVAL) {
    return NextResponse.json({ success: true, skipped: true, message: "Too soon since last run" })
  }
  lastRun = now

  try {
    const results = await checkAllWebsites()

    await aggregateAllWebsites().catch(() => {})

    return NextResponse.json({
      success: true,
      checked: results.length,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    return NextResponse.json({ error: "Monitoring check failed" }, { status: 500 })
  }
}
