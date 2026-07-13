"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { Card, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ResponseTimeChart } from "@/components/charts/ResponseTimeChart"
import { Skeleton } from "@/components/ui/skeleton"
import { formatDateAbsolute, formatDuration } from "@/lib/utils"
import Link from "next/link"
import toast from "react-hot-toast"
import {
  Gauge, Shield, Clock, ArrowLeft, RefreshCw,
  CheckCircle2, XCircle, Activity,
  FileText, BookOpen, ExternalLink, Layers, Server,
  Globe2,
  Lock, Bell, Search, Tag,
  Zap, ChevronRight, ChevronDown,
  MapPin, Target, AlertOctagon, AlertTriangle, Radio, BarChart3, TrendingUp,
  Wifi, Globe, Smartphone, Clock3,
} from "lucide-react"

interface WC {
  id: string
  status: string; statusCode: number | null; statusMessage: string | null
  responseTime: number | null; errorMessage: string | null
  dnsTime: number | null; tcpTime: number | null; tlsTime: number | null
  ttfb: number | null; downloadTime: number | null
  httpVersion: string | null; method: string | null
  contentType: string | null; contentLength: number | null
  contentEncoding: string | null; charset: string | null
  compression: string | null; server: string | null; poweredBy: string | null
  redirectCount: number | null; redirectChain: string | null; finalUrl: string | null
  resolvedIps: string | null; dnsRecords: string | null
  requestHeaders: string | null; responseHeaders: string | null
  securityHeaders: string | null; cookies: string | null; corsHeaders: string | null
  pageTitle: string | null; metaDescription: string | null; metaKeywords: string | null
  canonicalUrl: string | null; ogTitle: string | null; ogDescription: string | null
  ogImage: string | null; robotsTag: string | null; faviconUrl: string | null
  hsts: boolean | null; xFrameOptions: string | null
  contentSecurityPolicy: string | null; bodyPreview: string | null
  primaryIp: string | null; ipVersion: string | null
  isAnomaly: boolean | null; anomalyDeviation: number | null
  checkedAt: string
}

interface SSL {
  id: string; websiteId: string
  valid: boolean; expiryDate: string; issuer: string | null; subjectName: string | null
  validFrom: string | null; validTo: string | null
  certificateChain: string | null; issuedBy: string | null
  serialNumber: string | null; fingerprint: string | null; fingerprint256: string | null
  protocol: string | null; cipherSuite: string | null; keyExchange: string | null
  keyAlgorithm: string | null; keySize: number | null; signatureAlgorithm: string | null
  san: string | null; dnsNames: string | null
  isCA: boolean | null; selfSigned: boolean | null; ocspStapled: boolean | null
  crlUrls: string | null; ocspUrls: string | null
  weakProtocol: boolean | null; weakCipher: boolean | null
  checkedAt: string
}

interface Incident {
  id: string; websiteId: string; startedAt: string; endedAt: string | null
  duration: number | null; resolved: boolean; severity: string
  rootCause: string | null; impactSummary: string | null
  updates: { id: string; message: string; status: string | null; createdAt: string }[]
}

interface RegionCheck {
  id: string; region: string; status: string; statusCode: number | null
  responseTime: number | null; errorMessage: string | null; checkedAt: string
}

function InfoRow({ label, value, mono, warn }: { label: string; value: React.ReactNode; mono?: boolean; warn?: boolean }) {
  return (
    <div className="flex items-start justify-between py-2 border-b border-[var(--border)] last:border-0">
      <span className="text-xs text-[var(--muted-foreground)] shrink-0 mr-4">{label}</span>
      <span className={`text-sm text-right break-all ${mono ? "font-mono" : ""} ${warn ? "text-red-500" : "text-[var(--foreground)]"}`}>
        {value ?? "—"}
      </span>
    </div>
  )
}

function Section({ title, icon: Icon, children, defaultOpen = true }: {
  title: string; icon: any; children: React.ReactNode; defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <Card>
      <button onClick={() => setOpen(!open)} className="w-full text-left">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Icon className="w-4 h-4 text-[var(--primary)]" />
            <CardTitle>{title}</CardTitle>
          </div>
          {open ? <ChevronDown className="w-4 h-4 text-[var(--muted-foreground)]" /> : <ChevronRight className="w-4 h-4 text-[var(--muted-foreground)]" />}
        </CardHeader>
      </button>
      {open && <div className="px-5 pb-5">{children}</div>}
    </Card>
  )
}

function TimingBar({ label, value, max }: { label: string; value: number | null; max: number }) {
  if (value === null) return null
  const pct = Math.min((value / max) * 100, 100)
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-[var(--muted-foreground)] w-16 shrink-0">{label}</span>
      <div className="flex-1 h-2.5 rounded-full bg-[var(--muted)] overflow-hidden">
        <div className="h-full rounded-full bg-[var(--primary)] transition-all" style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-mono text-[var(--foreground)] w-20 text-right">{value}ms</span>
    </div>
  )
}

function HeadersTable({ headers }: { headers: string | null }) {
  if (!headers) return <p className="text-xs text-[var(--muted-foreground)]">No headers captured</p>
  let parsed: Record<string, string>
  try { parsed = JSON.parse(headers) } catch { return <p className="text-xs text-[var(--muted-foreground)]">Invalid headers</p> }
  return (
    <div className="overflow-x-auto max-h-64 overflow-y-auto">
      <table className="w-full text-xs font-mono">
        <thead><tr className="border-b border-[var(--border)]">
          <th className="text-left py-1.5 pr-3 text-[var(--muted-foreground)] font-medium">Header</th>
          <th className="text-left py-1.5 pr-3 text-[var(--muted-foreground)] font-medium">Value</th>
        </tr></thead>
        <tbody>{Object.entries(parsed).map(([k, v]) => (
          <tr key={k} className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--accent)]/30">
            <td className="py-1 pr-3 text-[var(--primary)] whitespace-nowrap">{k}</td>
            <td className="py-1 text-[var(--foreground)] break-all">{v}</td>
          </tr>
        ))}</tbody>
      </table>
    </div>
  )
}

function TagsSection({ websiteId }: { websiteId: string }) {
  const [tags, setTags] = useState<{ id: string; name: string; color: string }[]>([])
  const [allTags, setAllTags] = useState<{ id: string; name: string; color: string }[]>([])
  const [open, setOpen] = useState(false)

  useEffect(() => {
    fetch("/api/tags").then(r => r.json()).then(setAllTags)
    fetch(`/api/websites/${websiteId}/tags`).then(r => r.json()).then(setTags)
  }, [])

  async function toggleTag(tagId: string) {
    const current = tags.map(t => t.id)
    const next = current.includes(tagId) ? current.filter(id => id !== tagId) : [...current, tagId]
    const res = await fetch(`/api/websites/${websiteId}/tags`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tagIds: next }),
    })
    if (res.ok) { fetch(`/api/websites/${websiteId}/tags`).then(r => r.json()).then(setTags); toast.success("Tags updated") }
  }

  return (
    <Section title="Tags" icon={Tag} defaultOpen={false}>
      <div className="flex flex-wrap gap-2 mb-3">
        {tags.map(t => (
          <span key={t.id} className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium" style={{ backgroundColor: t.color + "20", color: t.color }}>
            {t.name}
            <button onClick={() => toggleTag(t.id)} className="hover:opacity-70">&times;</button>
          </span>
        ))}
        {tags.length === 0 && <span className="text-xs text-[var(--muted-foreground)]">No tags assigned</span>}
      </div>
      <button onClick={() => setOpen(!open)} className="text-xs text-[var(--primary)] hover:underline">{open ? "Hide tags" : "Manage tags"}</button>
      {open && (
        <div className="flex flex-wrap gap-2 mt-2">
          {allTags.map(t => {
            const active = tags.some(tg => tg.id === t.id)
            return (
              <button key={t.id} onClick={() => toggleTag(t.id)}
                className={`px-2 py-1 rounded-full text-xs font-medium transition-colors border ${active ? "border-[var(--primary)] bg-[var(--primary)]/10 text-[var(--primary)]" : "border-[var(--border)] text-[var(--muted-foreground)] hover:border-[var(--primary)]"}`}>
                {t.name}
              </button>
            )
          })}
        </div>
      )}
    </Section>
  )
}

function KeywordsSection({ websiteId }: { websiteId: string }) {
  const [keywords, setKeywords] = useState<{ id: string; keyword: string; mode: string; enabled: boolean; lastMatch?: boolean }[]>([])
  const [newKw, setNewKw] = useState("")
  const [newMode, setNewMode] = useState("present")

  useEffect(() => { fetch(`/api/keywords?websiteId=${websiteId}`).then(r => r.json()).then(setKeywords) }, [])

  async function addKeyword() {
    if (!newKw.trim()) return
    const res = await fetch("/api/keywords", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ websiteId, keyword: newKw.trim(), mode: newMode }),
    })
    if (res.ok) { setNewKw(""); fetch(`/api/keywords?websiteId=${websiteId}`).then(r => r.json()).then(setKeywords); toast.success("Keyword added") }
  }

  async function removeKeyword(id: string) {
    await fetch(`/api/keywords/${id}`, { method: "DELETE" })
    setKeywords(k => k.filter(x => x.id !== id))
  }

  async function toggleKeyword(kw: typeof keywords[0]) {
    const res = await fetch(`/api/keywords/${kw.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: !kw.enabled }),
    })
    if (res.ok) fetch(`/api/keywords?websiteId=${websiteId}`).then(r => r.json()).then(setKeywords)
  }

  return (
    <Section title="Keyword Monitoring" icon={Search} defaultOpen={false}>
      <div className="flex items-center gap-2 mb-3">
        <input value={newKw} onChange={e => setNewKw(e.target.value)} placeholder="e.g. pricing" className="flex-1 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-1.5 text-sm" onKeyDown={e => e.key === "Enter" && addKeyword()} />
        <select value={newMode} onChange={e => setNewMode(e.target.value)} className="rounded-lg border border-[var(--border)] bg-[var(--background)] px-2 py-1.5 text-sm">
          <option value="present">Should exist</option>
          <option value="absent">Should NOT exist</option>
        </select>
        <button onClick={addKeyword} className="px-3 py-1.5 rounded-lg bg-[var(--primary)] text-white text-sm font-medium hover:opacity-90">Add</button>
      </div>
      {keywords.length === 0 ? <p className="text-xs text-[var(--muted-foreground)]">No keywords configured</p> : (
        <div className="space-y-1.5">{keywords.map(kw => (
          <div key={kw.id} className="flex items-center justify-between p-2 rounded-lg border border-[var(--border)]">
            <div className="flex items-center gap-2">
              <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-[var(--secondary)]">{kw.mode}</span>
              <span className="text-sm font-mono">{kw.keyword}</span>
              {kw.lastMatch !== null && <span className={`text-xs ${kw.lastMatch ? "text-green-500" : "text-red-500"}`}>{kw.lastMatch ? "✓" : "✗"}</span>}
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => toggleKeyword(kw)} className={`px-2 py-0.5 text-xs rounded ${kw.enabled ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300" : "bg-gray-100 text-gray-500"}`}>{kw.enabled ? "On" : "Off"}</button>
              <button onClick={() => removeKeyword(kw.id)} className="text-red-500 hover:text-red-700 text-xs">Remove</button>
            </div>
          </div>
        ))}</div>
      )}
    </Section>
  )
}

function MaintenanceSection({ websiteId }: { websiteId: string }) {
  const [windows, setWindows] = useState<{ id: string; startsAt: string; endsAt: string; message: string | null }[]>([])
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ startsAt: "", endsAt: "", message: "" })

  useEffect(() => { fetch(`/api/maintenance?websiteId=${websiteId}`).then(r => r.json()).then(setWindows) }, [])

  async function addWindow() {
    if (!form.startsAt || !form.endsAt) return
    const res = await fetch("/api/maintenance", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ websiteId, ...form }),
    })
    if (res.ok) { setForm({ startsAt: "", endsAt: "", message: "" }); setShowForm(false); fetch(`/api/maintenance?websiteId=${websiteId}`).then(r => r.json()).then(setWindows); toast.success("Maintenance scheduled") }
  }

  async function removeWindow(id: string) {
    await fetch(`/api/maintenance/${id}`, { method: "DELETE" })
    setWindows(w => w.filter(x => x.id !== id))
  }

  const now = new Date()

  return (
    <Section title="Maintenance Windows" icon={Clock} defaultOpen={false}>
      <div className="space-y-2 mb-3">
        {windows.length === 0 ? <p className="text-xs text-[var(--muted-foreground)]">No maintenance windows scheduled</p> : windows.map(w => {
          const active = new Date(w.startsAt) <= now && new Date(w.endsAt) >= now
          return (
            <div key={w.id} className={`flex items-center justify-between p-3 rounded-lg border ${active ? "border-yellow-400 bg-yellow-50 dark:bg-yellow-950" : "border-[var(--border)]"}`}>
              <div>
                <div className="flex items-center gap-2">
                  {active && <span className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse" />}
                  <span className="text-sm font-medium">{new Date(w.startsAt).toLocaleString()} → {new Date(w.endsAt).toLocaleString()}</span>
                </div>
                {w.message && <p className="text-xs text-[var(--muted-foreground)] mt-0.5">{w.message}</p>}
              </div>
              <button onClick={() => removeWindow(w.id)} className="text-red-500 hover:text-red-700 text-xs">Cancel</button>
            </div>
          )
        })}
      </div>
      <button onClick={() => setShowForm(!showForm)} className="text-xs text-[var(--primary)] hover:underline">{showForm ? "Cancel" : "Schedule maintenance"}</button>
      {showForm && (
        <div className="mt-3 space-y-3 p-3 rounded-lg border border-[var(--border)]">
          <div><label className="block text-xs font-medium mb-1">Starts At</label>
            <input type="datetime-local" value={form.startsAt} onChange={e => setForm({ ...form, startsAt: e.target.value })} className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-1.5 text-sm" /></div>
          <div><label className="block text-xs font-medium mb-1">Ends At</label>
            <input type="datetime-local" value={form.endsAt} onChange={e => setForm({ ...form, endsAt: e.target.value })} className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-1.5 text-sm" /></div>
          <div><label className="block text-xs font-medium mb-1">Message (optional)</label>
            <input value={form.message} onChange={e => setForm({ ...form, message: e.target.value })} placeholder="Scheduled maintenance" className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-1.5 text-sm" /></div>
          <button onClick={addWindow} className="px-3 py-1.5 rounded-lg bg-[var(--primary)] text-white text-xs font-medium">Schedule</button>
        </div>
      )}
    </Section>
  )
}

function WebhooksSection({ websiteId }: { websiteId: string }) {
  const [webhooks, setWebhooks] = useState<{ id: string; name: string; url: string; type: string; events: string; enabled: boolean }[]>([])
  useEffect(() => { fetch(`/api/webhooks?websiteId=${websiteId}`).then(r => r.json()).then(setWebhooks) }, [])

  return (
    <Section title="Webhooks" icon={Bell} defaultOpen={false}>
      {webhooks.length === 0 ? <p className="text-xs text-[var(--muted-foreground)]">No webhooks configured. Go to <a href="/settings" className="text-[var(--primary)] hover:underline">Settings</a> to add one.</p> : (
        <div className="space-y-2">{webhooks.map(w => (
          <div key={w.id} className="flex items-center justify-between p-3 rounded-lg border border-[var(--border)]">
            <div>
              <div className="flex items-center gap-2">
                <span className="px-1.5 py-0.5 rounded text-[10px] bg-[var(--secondary)]">{w.type}</span>
                <span className="text-sm font-medium">{w.name}</span>
              </div>
              <p className="text-xs text-[var(--muted-foreground)] truncate max-w-[300px]">{w.url}</p>
            </div>
            <span className={`px-2 py-0.5 text-xs rounded ${w.enabled ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>{w.enabled ? "Active" : "Disabled"}</span>
          </div>
        ))}</div>
      )}
    </Section>
  )
}

function DnsPropagationSection({ websiteId }: { websiteId: string }) {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  async function check() {
    setLoading(true)
    try {
      const res = await fetch(`/api/dns-propagation?websiteId=${websiteId}`)
      const result = await res.json()
      setData(result)
    } catch { toast.error("DNS check failed") }
    finally { setLoading(false) }
  }

  return (
    <Section title="DNS Propagation" icon={MapPin} defaultOpen={false}>
      <div className="flex items-center gap-2 mb-3">
        <Button onClick={check} variant="secondary" size="sm">
          {loading ? "Checking..." : "Check DNS Propagation"}
        </Button>
        {data && <span className={`text-xs px-2 py-1 rounded-full ${data.consistent ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}`}>
          {data.consistent ? "Consistent" : "Inconsistent"}
        </span>}
      </div>
      {data && (
        <div className="space-y-2">
          {data.records.map((r: any) => (
            <div key={r.resolver} className="flex items-center justify-between p-2 rounded-lg border border-[var(--border)]">
              <div>
                <span className="text-xs font-medium text-[var(--foreground)]">{r.resolverName}</span>
                <span className="text-xs text-[var(--muted-foreground)] ml-2">({r.resolver})</span>
              </div>
              <div className="text-right">
                {r.error ? (
                  <span className="text-xs text-red-500">{r.error}</span>
                ) : (
                  <span className="text-xs font-mono text-[var(--foreground)]">{r.ips.join(", ")}</span>
                )}
                <span className="text-xs text-[var(--muted-foreground)] ml-2">{r.responseTime}ms</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </Section>
  )
}

function DomainInfoSection({ websiteId }: { websiteId: string }) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/domain?websiteId=${websiteId}`)
      .then(r => r.json()).then(setData).catch(() => {})
      .finally(() => setLoading(false))
  }, [websiteId])

  if (loading) return <Section title="Domain Info" icon={Globe2} defaultOpen={false}><Skeleton className="h-20" /></Section>
  if (!data || data.error) return null

  return (
    <Section title="Domain Info" icon={Globe2} defaultOpen={false}>
      {data.alert && <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 mb-3">
        <p className="text-xs text-amber-700 dark:text-amber-300 font-medium">{data.alert}</p>
      </div>}
      <div className="grid md:grid-cols-2 gap-4">
        <div>
          <InfoRow label="Domain" value={data.domain} mono />
          <InfoRow label="Registrar" value={data.registrar} />
          <InfoRow label="Organization" value={data.organization} />
        </div>
        <div>
          <InfoRow label="Created" value={data.creationDate ? formatDateAbsolute(data.creationDate) : "—"} />
          <InfoRow label="Expires" value={data.expiryDate ? formatDateAbsolute(data.expiryDate) : "—"} warn={data.daysUntilExpiry != null && data.daysUntilExpiry < 30} />
          <InfoRow label="Days Until Expiry" value={data.daysUntilExpiry != null ? String(data.daysUntilExpiry) : "—"} warn={data.daysUntilExpiry != null && data.daysUntilExpiry < 30} />
        </div>
      </div>
      {data.nameServers?.length > 0 && (
        <div className="mt-3">
          <h4 className="text-xs font-medium text-[var(--muted-foreground)] mb-1">Name Servers</h4>
          {data.nameServers.map((ns: string, i: number) => (
            <span key={i} className="inline-block text-xs font-mono bg-[var(--secondary)] px-2 py-0.5 rounded mr-2 mb-1">{ns}</span>
          ))}
        </div>
      )}
    </Section>
  )
}

function ExternalStatusSection({ websiteId, url }: { websiteId: string; url: string }) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [result, setResult] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  function check() {
    setLoading(true)
    fetch("/api/external-monitor", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ websiteId }),
    }).then(r => r.json()).then(setResult).catch(() => {}).finally(() => setLoading(false))
  }

  return (
    <Section title="External Verification" icon={Radio} defaultOpen={false}>
      <p className="text-xs text-[var(--muted-foreground)] mb-3">Verifies status from outside our network when direct checks fail</p>
      {!result && !loading && (
        <Button onClick={check} variant="ghost" size="sm">
          <Radio className="w-3 h-3 mr-1" /> Check via External Provider
        </Button>
      )}
      {loading && <Skeleton className="h-16" />}
      {result && !loading && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Badge variant={result.status === "online" ? "online" : result.status === "offline" ? "offline" : "default"}>
              {result.status}
            </Badge>
            <span className="text-xs text-[var(--muted-foreground)]">{result.message}</span>
          </div>
          {result.responseTime && <p className="text-xs">Response: {result.responseTime}ms via {result.provider}</p>}
          {result.status === "unknown" && (
            <p className="text-xs text-amber-600 dark:text-amber-400">No external providers configured. Add one in <Link href="/settings" className="underline">Settings</Link></p>
          )}
          <Button onClick={check} variant="ghost" size="sm" className="text-xs"><RefreshCw className="w-3 h-3 mr-1" /> Re-check</Button>
        </div>
      )}
    </Section>
  )
}

function TrafficInsightsSection({ websiteId }: { websiteId: string }) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    fetch(`/api/traffic?websiteId=${websiteId}`)
      .then(r => r.json()).then(setData).catch(() => {})
      .finally(() => setLoading(false))
  }, [websiteId])

  if (loading) return <Section title="Traffic Intelligence" icon={BarChart3} defaultOpen={false}><Skeleton className="h-32" /></Section>
  if (!data || data.error) return null

  const scoreColor = data.trafficScore >= 70 ? "text-emerald-500" : data.trafficScore >= 40 ? "text-amber-500" : "text-red-500"
  const scoreBg = data.trafficScore >= 70 ? "bg-emerald-500" : data.trafficScore >= 40 ? "bg-amber-500" : "bg-red-500"
  const levelLabel: Record<string, string> = { very_low: "Very Low", low: "Low", medium: "Medium", high: "High", very_high: "Very High" }

  return (
    <Section title="Traffic Intelligence" icon={BarChart3} defaultOpen={false}>
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="text-center p-3 rounded-lg bg-[var(--secondary)]">
          <div className={`text-2xl font-bold ${scoreColor}`}>{data.trafficScore}</div>
          <div className="text-[10px] text-[var(--muted-foreground)]">Traffic Score</div>
        </div>
        <div className="text-center p-3 rounded-lg bg-[var(--secondary)]">
          <div className="text-lg font-bold text-[var(--foreground)]">{data.estimatedDailyVisits}</div>
          <div className="text-[10px] text-[var(--muted-foreground)]">Est. Daily Visits</div>
        </div>
        <div className="text-center p-3 rounded-lg bg-[var(--secondary)]">
          <div className="text-lg font-bold text-[var(--foreground)]">{levelLabel[data.trafficLevel]}</div>
          <div className="text-[10px] text-[var(--muted-foreground)]">Traffic Level</div>
        </div>
      </div>

      <div className="mb-3">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-[var(--muted-foreground)]">Overall Score</span>
          <span className="text-xs font-medium">{data.trafficScore}/100</span>
        </div>
        <div className="w-full h-2 bg-[var(--secondary)] rounded-full overflow-hidden">
          <div className={`h-full ${scoreBg} rounded-full transition-all`} style={{ width: `${data.trafficScore}%` }} />
        </div>
        <p className="text-[10px] text-[var(--muted-foreground)] mt-1">Confidence: {data.confidence} — based on {data.confidence === "high" ? "200+" : data.confidence === "medium" ? "30-200" : "<30"} checks</p>
      </div>

      <div className="space-y-2 mb-3">
        {data.signals?.map((sig: any, i: number) => (
          <div key={i} className="flex items-center gap-2">
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium">{sig.name}</span>
                <span className="text-[10px] text-[var(--muted-foreground)]">{sig.score}/100</span>
              </div>
              <div className="w-full h-1 bg-[var(--secondary)] rounded-full mt-0.5">
                <div className={`h-full rounded-full ${sig.score >= 70 ? "bg-emerald-500" : sig.score >= 40 ? "bg-amber-500" : "bg-red-500"}`} style={{ width: `${sig.score}%` }} />
              </div>
              <p className="text-[10px] text-[var(--muted-foreground)] mt-0.5">{sig.description}</p>
            </div>
          </div>
        ))}
      </div>

      <button onClick={() => setExpanded(!expanded)} className="flex items-center gap-1 text-xs text-[var(--primary)] hover:underline mb-2">
        {expanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
        {expanded ? "Hide" : "Show"} detailed analysis
      </button>

      {expanded && (
        <div className="space-y-4 pt-2 border-t border-[var(--border)]">
          <div>
            <h4 className="text-xs font-medium text-[var(--foreground)] mb-2 flex items-center gap-1"><Wifi className="w-3 h-3" /> Technology Stack</h4>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <InfoRow label="Server" value={data.techStack?.server || "—"} mono />
              <InfoRow label="Framework" value={data.techStack?.framework || "—"} />
              <InfoRow label="CDN" value={data.techStack?.cdn || "None detected"} />
              <InfoRow label="HTTP" value={data.techStack?.httpVersion || "—"} />
              <InfoRow label="Compression" value={data.techStack?.compression || "—"} />
              <InfoRow label="Security" value={data.techStack?.ssl || "—"} />
            </div>
            {data.techStack?.technologies?.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {data.techStack.technologies.map((t: string, i: number) => (
                  <span key={i} className="text-[10px] px-1.5 py-0.5 rounded-full bg-[var(--secondary)] text-[var(--secondary-foreground)]">{t}</span>
                ))}
              </div>
            )}
          </div>

          <div>
            <h4 className="text-xs font-medium text-[var(--foreground)] mb-2 flex items-center gap-1"><Globe className="w-3 h-3" /> Domain Intelligence</h4>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <InfoRow label="Domain Age" value={data.domainIntelligence?.age || "—"} />
              <InfoRow label="Registrar" value={data.domainIntelligence?.registrar || "—"} />
              <InfoRow label="Organization" value={data.domainIntelligence?.organization || "—"} />
              <InfoRow label="DNS Complexity" value={data.domainIntelligence?.dnsComplexity || "—"} />
              <InfoRow label="IP Count" value={String(data.domainIntelligence?.ipCount || 0)} />
              <InfoRow label="CDN Protected" value={data.domainIntelligence?.hasCDN ? "Yes" : "No"} />
            </div>
          </div>

          <div>
            <h4 className="text-xs font-medium text-[var(--foreground)] mb-2 flex items-center gap-1"><Clock3 className="w-3 h-3" /> Performance</h4>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <InfoRow label="Avg Response" value={data.performanceInsights?.avgResponseTime ? `${data.performanceInsights.avgResponseTime}ms` : "—"} />
              <InfoRow label="Avg TTFB" value={data.performanceInsights?.avgTTFB ? `${data.performanceInsights.avgTTFB}ms` : "—"} />
              <InfoRow label="Grade" value={data.performanceInsights?.performanceGrade || "—"} />
              <InfoRow label="Server Load" value={data.performanceInsights?.serverLoad || "—"} />
              <InfoRow label="Consistency" value={data.performanceInsights?.consistency != null ? `${data.performanceInsights.consistency}%` : "—"} />
            </div>
          </div>

          <div>
            <h4 className="text-xs font-medium text-[var(--foreground)] mb-2 flex items-center gap-1"><FileText className="w-3 h-3" /> Content</h4>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <InfoRow label="Avg Page Size" value={data.contentInsights?.avgPageSize || "—"} />
              <InfoRow label="Compression" value={data.contentInsights?.compressionEnabled ? "Enabled" : "Disabled"} />
              <InfoRow label="Change Rate" value={data.contentInsights?.contentChangeRate || "—"} />
              <InfoRow label="SEO Score" value={data.contentInsights?.seoScore != null ? `${data.contentInsights.seoScore}/100` : "—"} />
            </div>
          </div>
        </div>
      )}
    </Section>
  )
}

function SLASection({ websiteId, slaTarget }: { websiteId: string; slaTarget: number }) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [data, setData] = useState<any>(null)

  useEffect(() => {
    fetch(`/api/sla?websiteId=${websiteId}&period=30d`).then(r => r.json()).then(setData).catch(() => {})
  }, [])

  if (!data?.websites?.length) return null
  const sla = data.websites[0]

  return (
    <Section title="SLA Compliance" icon={Target} defaultOpen={false}>
      <div className="grid md:grid-cols-3 gap-4">
        <div className="p-3 rounded-lg bg-[var(--secondary)]">
          <p className="text-xs text-[var(--muted-foreground)]">SLA Target</p>
          <p className="text-lg font-bold text-[var(--foreground)]">{slaTarget}%</p>
        </div>
        <div className="p-3 rounded-lg bg-[var(--secondary)]">
          <p className="text-xs text-[var(--muted-foreground)]">Current Uptime</p>
          <p className={`text-lg font-bold ${sla.slaMet ? "text-green-600" : "text-red-600"}`}>{sla.uptime}%</p>
        </div>
        <div className="p-3 rounded-lg bg-[var(--secondary)]">
          <p className="text-xs text-[var(--muted-foreground)]">Status</p>
          <p className={`text-lg font-bold ${sla.slaMet ? "text-green-600" : "text-red-600"}`}>
            {sla.slaMet ? "Met" : "Breached"}
          </p>
        </div>
      </div>
      {sla.daily?.length > 0 && (
        <div className="mt-3">
          <h4 className="text-xs font-medium text-[var(--muted-foreground)] mb-2">Daily Uptime (last 30 days)</h4>
          <div className="flex flex-wrap gap-1">
            {sla.daily.map((d: any) => (
              <div key={d.date} className={`w-3 h-3 rounded-sm ${d.uptime >= slaTarget ? "bg-green-500" : d.uptime >= 99 ? "bg-yellow-500" : "bg-red-500"}`}
                title={`${d.date}: ${d.uptime}%`} />
            ))}
          </div>
        </div>
      )}
    </Section>
  )
}

function RegionChecksSection({ regions }: { regions: RegionCheck[] }) {
  if (!regions.length) return null

  return (
    <Section title="Multi-Region Status" icon={MapPin} defaultOpen={false}>
      <div className="space-y-2">
        {regions.map(r => (
          <div key={r.id} className="flex items-center justify-between p-2 rounded-lg border border-[var(--border)]">
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${r.status === "online" ? "bg-green-500" : "bg-red-500"}`} />
              <span className="text-sm font-medium">{r.region}</span>
            </div>
            <div className="text-right">
              <span className="text-xs text-[var(--muted-foreground)]">{r.responseTime ? `${r.responseTime}ms` : "—"}</span>
              {r.errorMessage && <span className="text-xs text-red-500 ml-2 truncate max-w-[200px] block">{r.errorMessage}</span>}
            </div>
          </div>
        ))}
      </div>
    </Section>
  )
}

function IncidentTimelineSection({ incidents }: { incidents: Incident[] }) {
  if (!incidents.length) return null

  const severityColors: Record<string, string> = {
    critical: "bg-red-500", major: "bg-orange-500", minor: "bg-yellow-500",
  }

  return (
    <Section title="Incident Timeline" icon={AlertOctagon}>
      {incidents.map(inc => (
        <div key={inc.id} className="mb-4 last:mb-0">
          <div className="flex items-start gap-3">
            <div className="flex flex-col items-center">
              <div className={`w-3 h-3 rounded-full ${inc.resolved ? "bg-green-500" : severityColors[inc.severity] || "bg-red-500"} ${!inc.resolved ? "animate-pulse" : ""}`} />
              {inc.updates.length > 0 && <div className="w-0.5 h-full bg-[var(--border)] mt-1" />}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-medium text-[var(--foreground)]">{inc.resolved ? "Resolved" : "Ongoing"}</span>
                <Badge variant={inc.severity === "critical" ? "offline" : inc.severity === "major" ? "warning" : "online"}>{inc.severity}</Badge>
                {inc.duration && <span className="text-xs text-[var(--muted-foreground)]">({formatDuration(inc.duration)})</span>}
              </div>
              <p className="text-xs text-[var(--muted-foreground)]">{formatDateAbsolute(inc.startedAt)}</p>
              {inc.rootCause && <p className="text-xs text-[var(--muted-foreground)] mt-1">Cause: {inc.rootCause}</p>}
              {inc.impactSummary && <p className="text-xs text-[var(--muted-foreground)]">Impact: {inc.impactSummary}</p>}
              {inc.updates.length > 0 && (
                <div className="mt-2 space-y-1">
                  {inc.updates.map(u => (
                    <div key={u.id} className="flex items-start gap-2 text-xs">
                      <span className="text-[var(--muted-foreground)]">{formatDateAbsolute(u.createdAt)}</span>
                      {u.status && <Badge variant="default">{u.status}</Badge>}
                      <span className="text-[var(--foreground)]">{u.message}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      ))}
    </Section>
  )
}

export default function WebsiteDetailsPage() {
  const params = useParams()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [website, setWebsite] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => { fetchWebsite() }, [])

  async function fetchWebsite() {
    try {
      const res = await fetch(`/api/websites/${params.id}`)
      if (!res.ok) throw new Error("Not found")
      setWebsite(await res.json())
    } catch { toast.error("Failed to load website") }
    finally { setLoading(false) }
  }

  async function handleCheckNow() {
    try {
      await fetch("/api/monitor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ websiteId: params.id }),
      })
      toast.success("Check completed!")
      fetchWebsite()
    } catch { toast.error("Check failed") }
  }

  if (loading) return <div className="space-y-6">
    <Skeleton className="h-8 w-64" />
    <div className="grid md:grid-cols-4 gap-4">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28" />)}</div>
    <Skeleton className="h-64" />
  </div>

  if (!website) return <div className="text-center py-12 text-[var(--muted-foreground)]">Website not found</div>

  const c: WC | undefined = website.checks?.[0]
  const s: SSL | null = website.ssl
  const sslDays = s ? Math.floor((new Date(s.expiryDate).getTime() - Date.now()) / 86400000) : null
  const allChecks: WC[] = [...(website.checks || [])].reverse()
  const maxTiming = Math.max(c?.dnsTime || 0, c?.tcpTime || 0, c?.tlsTime || 0, c?.ttfb || 0, c?.downloadTime || 0, 100)

  return (
    <div className="space-y-6 max-w-6xl">
      {/* HEADER */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link href="/websites" className="p-2 rounded-lg hover:bg-[var(--accent)] text-[var(--muted-foreground)]"><ArrowLeft className="w-5 h-5" /></Link>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-bold text-[var(--foreground)]">{website.name}</h1>
              <Badge variant={website.status === "online" ? "online" : "offline"}>{website.status}</Badge>
              <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--secondary)] text-[var(--muted-foreground)]">{website.monitorType?.toUpperCase()}</span>
              {c?.isAnomaly && <Badge variant="warning">Anomaly</Badge>}
            </div>
            <a href={website.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-sm text-[var(--muted-foreground)] hover:text-[var(--primary)]">
              {website.url} <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-[var(--muted-foreground)]">{website._count?.checks || 0} checks</span>
          <Button onClick={handleCheckNow}><RefreshCw className="w-4 h-4 mr-1.5" />Check Now</Button>
        </div>
      </div>

      {/* ANOMALY ALERT */}
      {c?.isAnomaly && (
        <div className="p-4 rounded-lg bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-amber-600" />
            <span className="text-sm font-medium text-amber-700 dark:text-amber-300">
              Response time anomaly detected: {c.responseTime}ms ({c.anomalyDeviation?.toFixed(1)} standard deviations above mean)
            </span>
          </div>
        </div>
      )}

      {/* STATUS CARDS */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card><div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${website.status === "online" ? "bg-emerald-500/10" : "bg-red-500/10"}`}>
            {website.status === "online" ? <CheckCircle2 className="w-5 h-5 text-emerald-500" /> : <XCircle className="w-5 h-5 text-red-500" />}
          </div>
          <div><CardTitle>Status</CardTitle><p className="text-lg font-bold text-[var(--foreground)] capitalize">{website.status}</p>
            {c?.statusCode ? <p className="text-xs text-[var(--muted-foreground)]">HTTP {c.statusCode} {c.statusMessage}</p> : null}
          </div>
        </div></Card>
        <Card><div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-[var(--primary)]/10 flex items-center justify-center"><Gauge className="w-5 h-5 text-[var(--primary)]" /></div>
          <div><CardTitle>Response Time</CardTitle><p className="text-lg font-bold text-[var(--foreground)]">{c?.responseTime ? `${c.responseTime}ms` : "—"}</p>
            {c?.ttfb ? <p className="text-xs text-[var(--muted-foreground)]">TTFB: {c.ttfb}ms</p> : null}
          </div>
        </div></Card>
        <Card><div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${s?.valid ? "bg-emerald-500/10" : "bg-amber-500/10"}`}>
            <Shield className={`w-5 h-5 ${s?.valid ? "text-emerald-500" : "text-amber-500"}`} />
          </div>
          <div><CardTitle>SSL</CardTitle>{s ? <>
            <p className="text-lg font-bold text-[var(--foreground)]">{s.valid ? "Valid" : "Invalid"}</p>
            {sslDays !== null ? <p className={`text-xs ${sslDays < 30 ? "text-red-500" : "text-[var(--muted-foreground)]"}`}>{sslDays} days left</p> : null}
            {(s.weakProtocol || s.weakCipher) && <p className="text-xs text-amber-500">Weak security</p>}
          </> : <p className="text-sm text-[var(--muted-foreground)]">Not checked</p>}
          </div>
        </div></Card>
        <Card><div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-[var(--secondary)] flex items-center justify-center"><Server className="w-5 h-5 text-[var(--secondary-foreground)]" /></div>
          <div><CardTitle>Server</CardTitle>
            <p className="text-lg font-bold text-[var(--foreground)] text-sm">{c?.server || "—"}</p>
            <p className="text-xs text-[var(--muted-foreground)]">{c?.httpVersion || ""}</p>
          </div>
        </div></Card>
      </div>

      {/* CONSECUTIVE FAILURES */}
      {website.consecutiveFailures > 0 && (
        <Card>
          <div className="p-4 flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-500" />
            <div>
              <p className="text-sm font-medium text-[var(--foreground)]">{website.consecutiveFailures} consecutive failure(s)</p>
              <p className="text-xs text-[var(--muted-foreground)]">Threshold: {website.sensitivity} ({website.sensitivity === "strict" ? "1" : website.sensitivity === "relaxed" ? "3" : "2"} failures to trigger alert)</p>
            </div>
          </div>
        </Card>
      )}

      {/* NETWORK & DNS */}
      <Section title="Network & DNS" icon={Globe2}>
        <div className="grid md:grid-cols-2 gap-6">
          <div><h4 className="text-sm font-medium text-[var(--foreground)] mb-3">Connection</h4>
            <InfoRow label="Primary IP" value={c?.primaryIp} mono />
            <InfoRow label="IP Version" value={c?.ipVersion} />
            <InfoRow label="HTTP Version" value={c?.httpVersion} mono />
            <InfoRow label="Method" value={c?.method} mono />
            <InfoRow label="Final URL" value={c?.finalUrl ? <span className="break-all">{c.finalUrl}</span> : "—"} />
            <InfoRow label="Content Length" value={c?.contentLength ? `${(c.contentLength / 1024).toFixed(2)} KB` : "—"} />
            <InfoRow label="Content Type" value={c?.contentType} />
            <InfoRow label="Charset" value={c?.charset} />
            <InfoRow label="Encoding" value={c?.contentEncoding || c?.compression || "None"} />
          </div>
          <div><h4 className="text-sm font-medium text-[var(--foreground)] mb-3">DNS Records</h4>
            {c?.dnsRecords ? (() => {
              let dr: any; try { dr = JSON.parse(c.dnsRecords) } catch { return <p className="text-xs text-[var(--muted-foreground)]">Parse error</p> }
              return <>
                {dr.a?.length ? <InfoRow label="A Records" value={dr.a.join(", ")} mono /> : null}
                {dr.aaaa?.length ? <InfoRow label="AAAA Records" value={dr.aaaa.join(", ")} mono /> : null}
                {dr.mx?.length ? <InfoRow label="MX Records" value={dr.mx.join(", ")} mono /> : null}
                {dr.ns?.length ? <InfoRow label="NS Records" value={dr.ns.join(", ")} mono /> : null}
                {dr.txt?.length ? <InfoRow label="TXT Records" value={dr.txt.slice(0, 2).join("; ")} mono /> : null}
                {dr.cname ? <InfoRow label="CNAME" value={dr.cname} mono /> : null}
              </>
            })() : <p className="text-xs text-[var(--muted-foreground)]">No DNS data</p>}
          </div>
        </div>
        <div className="mt-4"><h4 className="text-sm font-medium text-[var(--foreground)] mb-3">Timing Breakdown</h4>
          {c?.errorMessage ? <div className="p-3 rounded-lg bg-red-500/10 text-red-600 text-sm"><p className="font-medium">Error</p><p className="text-xs mt-1 break-all">{c.errorMessage}</p></div>
          : c?.responseTime ? <div className="space-y-2">
            <TimingBar label="DNS" value={c.dnsTime} max={maxTiming} />
            <TimingBar label="TCP" value={c.tcpTime} max={maxTiming} />
            <TimingBar label="TLS" value={c.tlsTime} max={maxTiming} />
            <TimingBar label="TTFB" value={c.ttfb} max={maxTiming} />
            <TimingBar label="Download" value={c.downloadTime} max={maxTiming} />
            <div className="pt-2 mt-2 border-t border-[var(--border)] flex justify-between">
              <span className="font-medium text-[var(--foreground)]">Total</span>
              <span className="font-mono font-bold text-[var(--primary)]">{c.responseTime}ms</span>
            </div>
          </div> : <p className="text-xs text-[var(--muted-foreground)]">No timing data</p>}
        </div>
      </Section>

      {/* HTTP DETAILS */}
      <Section title="HTTP Response" icon={Server}>
        <div className="grid md:grid-cols-2 gap-6">
          <div><h4 className="text-sm font-medium text-[var(--foreground)] mb-3">Status & Info</h4>
            <InfoRow label="Status Code" value={c?.statusCode ? <Badge variant={c.statusCode < 300 ? "online" : c.statusCode < 400 ? "warning" : "offline"}>{c.statusCode}</Badge> : "—"} />
            <InfoRow label="Status Message" value={c?.statusMessage} />
            <InfoRow label="Server" value={c?.server} />
            <InfoRow label="X-Powered-By" value={c?.poweredBy} />
            <InfoRow label="HTTP Version" value={c?.httpVersion} mono />
            <InfoRow label="Content Type" value={c?.contentType} />
          </div>
          <div><h4 className="text-sm font-medium text-[var(--foreground)] mb-3">Redirects</h4>
            <InfoRow label="Redirect Count" value={c?.redirectCount} />
            <InfoRow label="Final URL" value={c?.finalUrl ? <span className="font-mono text-xs break-all">{c.finalUrl}</span> : "—"} />
            {c?.redirectChain ? <div className="mt-2 p-3 rounded-lg bg-[var(--secondary)]">
              <p className="text-xs font-medium text-[var(--muted-foreground)] mb-2">Chain:</p>
              {c.redirectChain.split(" → ").map((url, i, arr) => (
                <div key={i} className="flex items-center gap-2">
                  <div className="flex flex-col items-center">
                    <div className="w-2 h-2 rounded-full bg-[var(--primary)]" />
                    {i < arr.length - 1 && <div className="w-0.5 h-3 bg-[var(--border)]" />}
                  </div>
                  <span className="text-xs font-mono text-[var(--foreground)] break-all">{url}</span>
                </div>
              ))}
            </div> : null}
          </div>
        </div>
      </Section>

      {/* SECURITY HEADERS */}
      <Section title="Security Headers" icon={Lock}>
        {c?.securityHeaders ? (() => {
          let sh: any; try { sh = JSON.parse(c.securityHeaders) } catch { return <p className="text-xs text-[var(--muted-foreground)]">Parse error</p> }
          return <div className="grid md:grid-cols-2 gap-4">
            <div>
              <h4 className="text-sm font-medium mb-3 text-[var(--foreground)]">HTTP Security</h4>
              <InfoRow label="HSTS" value={sh.hsts?.present ? "Present" : "Missing"} warn={!sh.hsts?.present} />
              {sh.hsts?.present && <>
                <InfoRow label="HSTS Max-Age" value={`${sh.hsts.maxAge}s (${Math.floor(sh.hsts.maxAge / 86400)} days)`} />
                <InfoRow label="Include Subdomains" value={sh.hsts.includeSubDomains ? "Yes" : "No"} />
                <InfoRow label="Preload" value={sh.hsts.preload ? "Yes" : "No"} />
              </>}
              <InfoRow label="X-Frame-Options" value={sh.xFrameOptions || "Missing"} warn={!sh.xFrameOptions} />
              <InfoRow label="X-Content-Type-Options" value={sh.xContentTypeOptions || "Missing"} warn={!sh.xContentTypeOptions} />
            </div>
            <div>
              <h4 className="text-sm font-medium mb-3 text-[var(--foreground)]">CSP & CORS</h4>
              <InfoRow label="CSP Present" value={sh.csp?.present ? "Yes" : "No"} />
              <h4 className="text-sm font-medium mt-4 mb-3 text-[var(--foreground)]">CORS</h4>
              <InfoRow label="Allow-Origin" value={sh.cors?.allowOrigin || "Not set"} />
            </div>
          </div>
        })() : <p className="text-xs text-[var(--muted-foreground)]">No security header data</p>}
      </Section>

      {/* PAGE META */}
      <Section title="Page Metadata" icon={Search} defaultOpen={false}>
        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <InfoRow label="Page Title" value={c?.pageTitle} />
            <InfoRow label="Description" value={c?.metaDescription} />
            <InfoRow label="Canonical URL" value={c?.canonicalUrl} />
          </div>
          <div>
            <InfoRow label="OG Title" value={c?.ogTitle} />
            <InfoRow label="OG Description" value={c?.ogDescription} />
            <InfoRow label="OG Image" value={c?.ogImage ? <span className="text-xs break-all">{c.ogImage}</span> : "—"} />
          </div>
        </div>
      </Section>

      {/* BODY PREVIEW */}
      {c?.bodyPreview ? (
        <Section title="Response Body Preview" icon={BookOpen} defaultOpen={false}>
          <pre className="text-xs font-mono text-[var(--foreground)] bg-[var(--muted)] p-4 rounded-lg overflow-x-auto max-h-64 overflow-y-auto whitespace-pre-wrap break-all">
            {c.bodyPreview}
          </pre>
        </Section>
      ) : null}

      {/* SSL / TLS */}
      {s ? (
        <Section title="SSL / TLS Certificate" icon={Shield}>
          <div className="grid md:grid-cols-3 gap-4">
            <div>
              <InfoRow label="Valid" value={s.valid ? "Valid" : "Invalid"} warn={!s.valid} />
              <InfoRow label="Subject" value={s.subjectName} />
              <InfoRow label="Issuer" value={s.issuer} />
              <InfoRow label="Self-Signed" value={s.selfSigned ? "Yes" : "No"} warn={!!s.selfSigned} />
            </div>
            <div>
              <InfoRow label="Valid From" value={s.validFrom ? formatDateAbsolute(s.validFrom) : "—"} />
              <InfoRow label="Valid To" value={s.validTo ? formatDateAbsolute(s.validTo) : "—"} />
              <InfoRow label="Days Remaining" value={sslDays !== null ? sslDays < 0 ? "Expired" : `${sslDays} days` : "—"} warn={sslDays !== null && sslDays < 30} />
            </div>
            <div>
              <InfoRow label="Protocol" value={s.protocol} warn={!!s.weakProtocol} />
              <InfoRow label="Cipher Suite" value={s.cipherSuite} warn={!!s.weakCipher} />
              <InfoRow label="Key Size" value={s.keySize ? `${s.keySize} bits` : "—"} />
              {s.weakProtocol && <p className="text-xs text-amber-500 mt-1">Weak protocol detected (e.g., TLS 1.0/1.1)</p>}
              {s.weakCipher && <p className="text-xs text-amber-500 mt-1">Weak cipher suite detected</p>}
            </div>
          </div>
        </Section>
      ) : (
        <Section title="SSL / TLS Certificate" icon={Shield} defaultOpen={false}>
          <p className="text-xs text-[var(--muted-foreground)]">Not checked yet. Click "Check Now" to analyze SSL.</p>
        </Section>
      )}

      {/* RESPONSE TIME CHART */}
      <Card>
        <CardHeader><CardTitle>Response Time History</CardTitle>
          <div className="flex items-center gap-1 text-xs text-[var(--muted-foreground)]"><Activity className="w-3 h-3" />Last {allChecks.length} checks</div>
        </CardHeader>
        <ResponseTimeChart data={allChecks.filter(c => c.responseTime).map(c => ({ date: c.checkedAt, time: c.responseTime! }))} />
      </Card>

      {/* MULTI-REGION */}
      <RegionChecksSection regions={website.regionChecks || []} />

      {/* DNS PROPAGATION */}
      <DnsPropagationSection websiteId={website.id} />

      {/* DOMAIN INFO */}
      <DomainInfoSection websiteId={website.id} />

      {/* EXTERNAL VERIFICATION */}
      <ExternalStatusSection websiteId={website.id} url={website.url} />

      {/* TRAFFIC INTELLIGENCE */}
      <TrafficInsightsSection websiteId={website.id} />

      {/* SLA */}
      <SLASection websiteId={website.id} slaTarget={website.slaTarget || 99.9} />

      {/* TAGS */}
      <TagsSection websiteId={website.id} />

      {/* KEYWORDS */}
      <KeywordsSection websiteId={website.id} />

      {/* MAINTENANCE */}
      <MaintenanceSection websiteId={website.id} />

      {/* WEBHOOKS */}
      <WebhooksSection websiteId={website.id} />

      {/* INCIDENT TIMELINE */}
      <IncidentTimelineSection incidents={website.incidents || []} />

      {/* CHECK LOG */}
      <Card>
        <CardHeader><CardTitle>Full Check Log</CardTitle>
          <div className="flex items-center gap-1 text-xs text-[var(--muted-foreground)]"><Layers className="w-3 h-3" />{allChecks.length} checks</div>
        </CardHeader>
        <div className="overflow-x-auto max-h-96 overflow-y-auto">
          <table className="w-full text-xs">
            <thead><tr className="border-b border-[var(--border)]">
              {["Time","Status","Code","Total","DNS","TCP","TLS","TTFB","DL","Server","Anomaly"].map(h => (
                <th key={h} className="text-left py-1.5 px-2 text-[var(--muted-foreground)] font-medium whitespace-nowrap">{h}</th>
              ))}
            </tr></thead>
            <tbody>{allChecks.slice(0, 100).map((ch) => (
              <tr key={ch.id} className="border-b border-[var(--border)] hover:bg-[var(--accent)]/50 font-mono">
                <td className="py-1 px-2 text-[var(--muted-foreground)] whitespace-nowrap">{new Date(ch.checkedAt).toLocaleTimeString()}</td>
                <td className="py-1 px-2"><Badge variant={ch.status === "online" ? "online" : "offline"} className="text-[10px] px-1.5 py-0">{ch.status}</Badge></td>
                <td className="py-1 px-2">{ch.statusCode || "—"}</td>
                <td className="py-1 px-2">{ch.responseTime ? `${ch.responseTime}ms` : "—"}</td>
                <td className="py-1 px-2">{ch.dnsTime ? `${ch.dnsTime}ms` : "—"}</td>
                <td className="py-1 px-2">{ch.tcpTime ? `${ch.tcpTime}ms` : "—"}</td>
                <td className="py-1 px-2">{ch.tlsTime ? `${ch.tlsTime}ms` : "—"}</td>
                <td className="py-1 px-2">{ch.ttfb ? `${ch.ttfb}ms` : "—"}</td>
                <td className="py-1 px-2">{ch.downloadTime ? `${ch.downloadTime}ms` : "—"}</td>
                <td className="py-1 px-2">{ch.server || "—"}</td>
                <td className="py-1 px-2">{ch.isAnomaly ? <Zap className="w-3 h-3 text-amber-500" /> : "—"}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
