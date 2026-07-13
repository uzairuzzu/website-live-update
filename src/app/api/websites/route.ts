import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { getWebsites, createWebsite } from "@/services/website.service"
import { performCheck } from "@/lib/monitor"

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const websites = await getWebsites(session.user.id)
  return NextResponse.json(websites)
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const body = await req.json()
    const { name, url, interval } = body

    if (!name || !url) {
      return NextResponse.json(
        { error: "Name and URL are required" },
        { status: 400 }
      )
    }

    // Normalize URL: add https:// if missing
    const normalizedUrl = url.trim()
    const finalUrl = /^https?:\/\//i.test(normalizedUrl) ? normalizedUrl : "https://" + normalizedUrl

    const website = await createWebsite(session.user.id, {
      name,
      url: finalUrl,
      interval: interval || 5,
    })

    performCheck(website.id)

    return NextResponse.json(website, { status: 201 })
  } catch (error) {
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    )
  }
}
