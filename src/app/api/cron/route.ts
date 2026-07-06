import { NextResponse } from "next/server"
import { checkAllWebsites } from "@/lib/monitor"

export const dynamic = "force-dynamic"
export const maxDuration = 300

export async function GET() {
  try {
    const results = await checkAllWebsites()
    return NextResponse.json({
      success: true,
      checked: results.length,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    return NextResponse.json(
      { error: "Monitoring check failed" },
      { status: 500 }
    )
  }
}
