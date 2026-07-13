import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

const clients = new Map<string, ReadableStreamDefaultController>()

export const dynamic = "force-dynamic"

export async function GET(req: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 })
  }

  const userId = session.user.id

  const stream = new ReadableStream({
    start(controller) {
      clients.set(userId, controller)

      const encoder = new TextEncoder()
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "connected" })}\n\n`))

      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "heartbeat" })}\n\n`))
        } catch {
          clearInterval(heartbeat)
        }
      }, 30000)

      req.signal?.addEventListener("abort", () => {
        clients.delete(userId)
        clearInterval(heartbeat)
        try { controller.close() } catch {}
      })
    },
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  })
}

export function broadcastToUser(userId: string, data: any) {
  const controller = clients.get(userId)
  if (controller) {
    try {
      const encoder = new TextEncoder()
      controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
    } catch {
      clients.delete(userId)
    }
  }
}

export async function broadcastStatusChange(websiteId: string, status: string, websiteName: string) {
  const website = await prisma.website.findUnique({ where: { id: websiteId }, select: { userId: true } })
  if (website) {
    broadcastToUser(website.userId, {
      type: "status_change",
      websiteId,
      websiteName,
      status,
      timestamp: new Date().toISOString(),
    })
  }
}
