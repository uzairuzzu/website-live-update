import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import {
  getWebsiteById,
  updateWebsite,
  deleteWebsite,
} from "@/services/website.service"

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params
  const website = await getWebsiteById(id, session.user.id)
  if (!website) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }
  return NextResponse.json(website)
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params
  const body = await req.json()
  const website = await updateWebsite(id, session.user.id, body)
  if (!website) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }
  return NextResponse.json(website)
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params
  const website = await deleteWebsite(id, session.user.id)
  if (!website) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }
  return NextResponse.json({ message: "Deleted successfully" })
}
