import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { getNotifications, getUnreadCount, markAsRead } from "@/services/notification.service"

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const notifications = await getNotifications(session.user.id)
  return NextResponse.json(notifications)
}

export async function PUT(req: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await req.json()
  await markAsRead(id)
  return NextResponse.json({ success: true })
}
