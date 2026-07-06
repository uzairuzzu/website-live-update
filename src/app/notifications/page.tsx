"use client"

import { useEffect, useState } from "react"
import { Card, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Bell, Mail, MessageCircle, Hash, CheckCheck } from "lucide-react"
import { formatDateAbsolute } from "@/lib/utils"

interface NotificationItem {
  id: string
  type: string
  message: string | null
  read: boolean
  createdAt: string
  website: { name: string; url: string }
}

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchNotifications()
  }, [])

  async function fetchNotifications() {
    try {
      const res = await fetch("/api/notifications")
      const data = await res.json()
      setNotifications(data)
    } catch {
      console.error("Failed to load notifications")
    } finally {
      setLoading(false)
    }
  }

  const typeIcons: Record<string, typeof Bell> = {
    email: Mail,
    telegram: MessageCircle,
    discord: MessageCircle,
    slack: Hash,
  }

  const typeColors: Record<string, string> = {
    email: "text-blue-500 bg-blue-500/10",
    telegram: "text-sky-500 bg-sky-500/10",
    discord: "text-indigo-500 bg-indigo-500/10",
    slack: "text-purple-500 bg-purple-500/10",
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--foreground)]">
            Notifications
          </h1>
          <p className="text-sm text-[var(--muted-foreground)]">
            Monitor alerts and updates
          </p>
        </div>
        <Button variant="secondary">
          <CheckCheck className="w-4 h-4 mr-1.5" />
          Mark All Read
        </Button>
      </div>

      <div className="grid md:grid-cols-4 gap-4">
        <Card>
          <CardTitle className="text-center">Email</CardTitle>
          <div className="flex justify-center mt-2">
            <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
              <Mail className="w-5 h-5 text-blue-500" />
            </div>
          </div>
        </Card>
        <Card>
          <CardTitle className="text-center">Telegram</CardTitle>
          <div className="flex justify-center mt-2">
            <div className="w-10 h-10 rounded-lg bg-sky-500/10 flex items-center justify-center">
              <MessageCircle className="w-5 h-5 text-sky-500" />
            </div>
          </div>
        </Card>
        <Card>
          <CardTitle className="text-center">Discord</CardTitle>
          <div className="flex justify-center mt-2">
            <div className="w-10 h-10 rounded-lg bg-indigo-500/10 flex items-center justify-center">
              <MessageCircle className="w-5 h-5 text-indigo-500" />
            </div>
          </div>
        </Card>
        <Card>
          <CardTitle className="text-center">Slack</CardTitle>
          <div className="flex justify-center mt-2">
            <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
              <Hash className="w-5 h-5 text-purple-500" />
            </div>
          </div>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Alerts</CardTitle>
          <Badge variant="default">
            {notifications.filter((n) => !n.read).length} unread
          </Badge>
        </CardHeader>
        <div className="space-y-2">
          {notifications.map((n) => {
            const Icon = typeIcons[n.type] || Bell
            const color = typeColors[n.type] || ""
            return (
              <div
                key={n.id}
                className={`flex items-start gap-3 p-3 rounded-lg ${
                  n.read ? "opacity-60" : "bg-[var(--secondary)]"
                }`}
              >
                <div
                  className={`w-8 h-8 rounded-lg flex items-center justify-center ${color}`}
                >
                  <Icon className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[var(--foreground)]">
                    {n.website.name}
                  </p>
                  <p className="text-xs text-[var(--muted-foreground)]">
                    {n.message || `${n.type} notification`}
                  </p>
                </div>
                <span className="text-xs text-[var(--muted-foreground)] shrink-0">
                  {formatDateAbsolute(n.createdAt)}
                </span>
              </div>
            )
          })}
          {notifications.length === 0 && !loading && (
            <p className="text-sm text-[var(--muted-foreground)] text-center py-6">
              No notifications yet
            </p>
          )}
        </div>
      </Card>
    </div>
  )
}
