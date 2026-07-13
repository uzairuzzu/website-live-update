"use client"
import { useEffect, useState } from "react"

type WebsiteData = {
  id: string; name: string; url: string; status: string; monitorType: string
  tags: { name: string; color: string }[]
  lastCheck: { statusCode: number | null; responseTime: number | null; checkedAt: string } | null
  activeIncidents: { id: string; startedAt: string; severity: string }[]
  regionChecks: { region: string; status: string; responseTime: number | null }[]
  maintenance: string | null
  uptime24h: number
  ssl: { valid: boolean; expiryDate: string } | null
}

export default function StatusPageClient({ userName, userImage, websites: initial }: {
  userName: string; userImage: string | null; websites: WebsiteData[]
}) {
  const [websites, setWebsites] = useState(initial)
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})

  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const res = await fetch(window.location.href, { headers: { Accept: "application/json" } })
        if (res.ok) {
          const data = await res.json()
          if (data.websites) setWebsites(data.websites)
        }
      } catch {}
    }, 30000)
    return () => clearInterval(interval)
  }, [])

  const allOnline = websites.every(w => w.status === "online" || w.maintenance)

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <div className="max-w-3xl mx-auto px-4 py-12">
        <div className="text-center mb-10">
          <h1 className="text-3xl font-bold text-[var(--foreground)] mb-2">{userName} Status</h1>
          <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium ${
            allOnline ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300" : "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300"
          }`}>
            <span className={`w-2 h-2 rounded-full ${allOnline ? "bg-green-500" : "bg-red-500"} animate-pulse`} />
            {allOnline ? "All Systems Operational" : "Some Systems Degraded"}
          </div>
        </div>

        <div className="space-y-4">
          {websites.map(w => {
            const isOpen = collapsed[w.id] !== false
            const statusColor = w.maintenance ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300"
              : w.status === "online" ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
              : "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300"

            return (
              <div key={w.id} className="rounded-xl border border-[var(--border)] bg-[var(--card)] overflow-hidden">
                <button onClick={() => setCollapsed({ ...collapsed, [w.id]: !isOpen })}
                  className="w-full flex items-center justify-between p-4 hover:bg-[var(--accent)]/50 transition-colors">
                  <div className="flex items-center gap-3">
                    <span className={`w-2.5 h-2.5 rounded-full ${w.maintenance ? "bg-yellow-400" : w.status === "online" ? "bg-green-500" : "bg-red-500"}`} />
                    <div className="text-left">
                      <span className="font-medium text-[var(--foreground)]">{w.name}</span>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--secondary)] text-[var(--muted-foreground)]">{w.monitorType?.toUpperCase()}</span>
                        {w.tags.map(t => (
                          <span key={t.name} className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ backgroundColor: t.color + "20", color: t.color }}>{t.name}</span>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {w.maintenance ? (
                      <span className="text-xs px-2 py-1 rounded-full bg-yellow-100 dark:bg-yellow-900 text-yellow-700 dark:text-yellow-300">Maintenance</span>
                    ) : w.activeIncidents.length > 0 ? (
                      <span className="text-xs px-2 py-1 rounded-full bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300">{w.activeIncidents.length} active</span>
                    ) : null}
                    <span className={`text-xs px-2 py-1 rounded-full ${statusColor}`}>
                      {w.maintenance ? "Under Maintenance" : w.status}
                    </span>
                    <svg className={`w-4 h-4 text-[var(--muted-foreground)] transition-transform ${isOpen ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </button>

                {isOpen && (
                  <div className="px-4 pb-4 border-t border-[var(--border)] pt-3">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <p className="text-[var(--muted-foreground)] text-xs">URL</p>
                        <p className="font-mono text-xs truncate">{w.url}</p>
                      </div>
                      {w.lastCheck && (
                        <>
                          <div>
                            <p className="text-[var(--muted-foreground)] text-xs">Status Code</p>
                            <p className="font-mono">{w.lastCheck.statusCode}</p>
                          </div>
                          <div>
                            <p className="text-[var(--muted-foreground)] text-xs">Response Time</p>
                            <p className="font-mono">{w.lastCheck.responseTime}ms</p>
                          </div>
                          <div>
                            <p className="text-[var(--muted-foreground)] text-xs">24h Uptime</p>
                            <p className="font-mono">{w.uptime24h}%</p>
                          </div>
                        </>
                      )}
                    </div>

                    {/* Region Status */}
                    {w.regionChecks.length > 0 && (
                      <div className="mt-3">
                        <p className="text-xs font-medium text-[var(--muted-foreground)] mb-1">Region Status</p>
                        <div className="flex flex-wrap gap-2">
                          {w.regionChecks.map((r, i) => (
                            <span key={i} className="flex items-center gap-1 text-xs">
                              <span className={`w-1.5 h-1.5 rounded-full ${r.status === "online" ? "bg-green-500" : "bg-red-500"}`} />
                              <span className="text-[var(--muted-foreground)]">{r.region}</span>
                              {r.responseTime && <span className="font-mono text-[var(--foreground)]">{r.responseTime}ms</span>}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* SSL Info */}
                    {w.ssl && (
                      <div className="mt-2">
                        <span className={`text-xs ${w.ssl.valid ? "text-green-600" : "text-red-600"}`}>
                          SSL: {w.ssl.valid ? "Valid" : "Invalid"}
                        </span>
                      </div>
                    )}

                    {w.activeIncidents.length > 0 && (
                      <div className="mt-3 p-3 rounded-lg bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800">
                        <p className="text-xs font-medium text-red-700 dark:text-red-300 mb-1">Active Incidents</p>
                        {w.activeIncidents.map(i => (
                          <div key={i.id} className="text-xs text-red-600 dark:text-red-400">
                            <span className={`inline-block w-1.5 h-1.5 rounded-full mr-1 ${
                              i.severity === "critical" ? "bg-red-500" : i.severity === "major" ? "bg-orange-500" : "bg-yellow-500"
                            }`} />
                            Since {new Date(i.startedAt).toLocaleString()} ({i.severity})
                          </div>
                        ))}
                      </div>
                    )}
                    {w.maintenance && (
                      <div className="mt-3 p-3 rounded-lg bg-yellow-50 dark:bg-yellow-950 border border-yellow-200 dark:border-yellow-800">
                        <p className="text-xs text-yellow-700 dark:text-yellow-300">{w.maintenance}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        <footer className="mt-10 text-center text-xs text-[var(--muted-foreground)]">
          Powered by <a href="/" className="underline hover:text-[var(--foreground)]">21by7 Monitor</a>
        </footer>
      </div>
    </div>
  )
}
