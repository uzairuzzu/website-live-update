"use client"

import { useEffect, useRef } from "react"
import { useSession } from "next-auth/react"

export function MonitorProvider({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession()
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const eventSourceRef = useRef<EventSource | null>(null)

  useEffect(() => {
    if (!session?.user?.id) return

    async function runChecks() {
      try {
        const res = await fetch("/api/websites")
        if (!res.ok) return
        const websites = await res.json()

        const needsCheck = websites.filter((w: any) => {
          if (!w.checks || w.checks.length === 0) return true
          const last = new Date(w.checks[0].checkedAt).getTime()
          const interval = (w.interval || 5) * 60 * 1000
          return Date.now() - last > interval
        })

        if (needsCheck.length === 0) return

        await fetch("/api/monitor", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        })
      } catch {}
    }

    runChecks()
    intervalRef.current = setInterval(runChecks, 60000)

    try {
      const es = new EventSource("/api/events")
      eventSourceRef.current = es

      es.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          if (data.type === "status_change") {
            runChecks()
          }
        } catch {}
      }

      es.onerror = () => {
        es.close()
      }
    } catch {}

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
      if (eventSourceRef.current) eventSourceRef.current.close()
    }
  }, [session?.user?.id])

  return <>{children}</>
}
