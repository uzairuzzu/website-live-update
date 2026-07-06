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
  Globe, Gauge, Shield, Clock, ArrowLeft, RefreshCw,
  CheckCircle2, XCircle, Activity, Route, Download,
  FileText, BookOpen, ExternalLink, Layers, Server,
  Network, Fingerprint, Hash, Info, Terminal, Globe2,
  Lock, Key, AlertTriangle, Cookie, Bell, Database,
  Frame, Search, Tag, Eye, FileCode, MessageSquare,
  Wifi, Zap, TrendingUp, ChevronRight, ChevronDown,
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
  crlUrls: string | null; ocspUrls: string | null; checkedAt: string
}

interface Incident {
  id: string; websiteId: string; startedAt: string; endedAt: string | null
  duration: number | null; resolved: boolean
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

export default function WebsiteDetailsPage() {
  const params = useParams()
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
          </> : <p className="text-sm text-[var(--muted-foreground)]">Not checked</p>}
          </div>
        </div></Card>
        <Card><div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-[var(--secondary)] flex items-center justify-center"><Wifi className="w-5 h-5 text-[var(--secondary-foreground)]" /></div>
          <div><CardTitle>Server</CardTitle>
            <p className="text-lg font-bold text-[var(--foreground)] text-sm">{c?.server || "—"}</p>
            <p className="text-xs text-[var(--muted-foreground)]">{c?.httpVersion || ""}</p>
          </div>
        </div></Card>
      </div>

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
        {/* Timing */}
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
            <InfoRow label="Content Length" value={c?.contentLength ? `${(c.contentLength / 1024).toFixed(2)} KB` : "—"} />
            <InfoRow label="Content Encoding" value={c?.contentEncoding || c?.compression || "None"} />
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
              <InfoRow label="HSTS" value={sh.hsts?.present ? "✅ Present" : "❌ Missing"} warn={!sh.hsts?.present} />
              {sh.hsts?.present && <>
                <InfoRow label="HSTS Max-Age" value={`${sh.hsts.maxAge}s (${Math.floor(sh.hsts.maxAge / 86400)} days)`} />
                <InfoRow label="Include Subdomains" value={sh.hsts.includeSubDomains ? "✅ Yes" : "❌ No"} />
                <InfoRow label="Preload" value={sh.hsts.preload ? "✅ Yes" : "❌ No"} />
              </>}
              <InfoRow label="X-Frame-Options" value={sh.xFrameOptions || "❌ Missing"} warn={!sh.xFrameOptions} />
              <InfoRow label="X-Content-Type-Options" value={sh.xContentTypeOptions || "❌ Missing"} warn={!sh.xContentTypeOptions} />
              <InfoRow label="Referrer-Policy" value={sh.referrerPolicy || "❌ Missing"} />
            </div>
            <div>
              <h4 className="text-sm font-medium mb-3 text-[var(--foreground)]">CSP & CORS</h4>
              <InfoRow label="CSP Present" value={sh.csp?.present ? "✅ Yes" : "❌ No"} />
              {sh.csp?.present && <InfoRow label="CSP Value" value={<span className="text-xs break-all">{sh.csp.value}</span>} />}
              <h4 className="text-sm font-medium mt-4 mb-3 text-[var(--foreground)]">CORS</h4>
              <InfoRow label="Allow-Origin" value={sh.cors?.allowOrigin || "Not set"} />
              <InfoRow label="Allow-Methods" value={sh.cors?.allowMethods || "Not set"} />
              <InfoRow label="Allow-Headers" value={sh.cors?.allowHeaders || "Not set"} />
              <InfoRow label="Allow-Credentials" value={sh.cors?.allowCredentials || "Not set"} />
            </div>
          </div>
        })() : <p className="text-xs text-[var(--muted-foreground)]">No security header data</p>}
      </Section>

      {/* PAGE META */}
      <Section title="Page Metadata" icon={Search}>
        <div className="grid md:grid-cols-2 gap-6">
          <div><h4 className="text-sm font-medium mb-3 text-[var(--foreground)]">Basic</h4>
            <InfoRow label="Page Title" value={c?.pageTitle} />
            <InfoRow label="Description" value={c?.metaDescription} />
            <InfoRow label="Keywords" value={c?.metaKeywords} />
            <InfoRow label="Canonical URL" value={c?.canonicalUrl} />
            <InfoRow label="Robots Tag" value={c?.robotsTag} />
            <InfoRow label="Favicon" value={c?.faviconUrl} />
          </div>
          <div><h4 className="text-sm font-medium mb-3 text-[var(--foreground)]">Open Graph</h4>
            <InfoRow label="OG Title" value={c?.ogTitle} />
            <InfoRow label="OG Description" value={c?.ogDescription} />
            <InfoRow label="OG Image" value={c?.ogImage ? <span className="text-xs break-all">{c.ogImage}</span> : "—"} />
          </div>
        </div>
      </Section>

      {/* COOKIES */}
      {c?.cookies && (() => {
        let parsed: Record<string, string>
        try { parsed = JSON.parse(c.cookies) } catch { return null }
        return Object.keys(parsed).length > 0 ? (
          <Section title="Cookies" icon={Cookie}>
            <div className="overflow-x-auto">
              <table className="w-full text-xs font-mono">
                <thead><tr className="border-b border-[var(--border)]">
                  <th className="text-left py-1.5 pr-3 text-[var(--muted-foreground)]">Name</th>
                  <th className="text-left py-1.5 text-[var(--muted-foreground)]">Value</th>
                </tr></thead>
                <tbody>{Object.entries(parsed).map(([k, v]) => (
                  <tr key={k} className="border-b border-[var(--border)] last:border-0">
                    <td className="py-1 pr-3 text-[var(--foreground)]">{k}</td>
                    <td className="py-1 text-[var(--muted-foreground)] break-all">{v}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          </Section>
        ) : null
      })()}

      {/* RESPONSE HEADERS */}
      <Section title="Response Headers" icon={FileText}>
        <HeadersTable headers={c?.responseHeaders || null} />
      </Section>

      {/* REQUEST HEADERS */}
      <Section title="Request Headers Sent" icon={Terminal}>
        <HeadersTable headers={c?.requestHeaders || null} />
      </Section>

      {/* BODY PREVIEW */}
      {c?.bodyPreview ? (
        <Section title="Response Body Preview" icon={BookOpen}>
          <div className="flex items-center gap-2 mb-3 text-xs text-[var(--muted-foreground)]">
            <FileCode className="w-3 h-3" />First {c.bodyPreview.length} characters
          </div>
          <pre className="text-xs font-mono text-[var(--foreground)] bg-[var(--muted)] p-4 rounded-lg overflow-x-auto max-h-64 overflow-y-auto whitespace-pre-wrap break-all">
            {c.bodyPreview}
          </pre>
        </Section>
      ) : null}

      {/* SSL / TLS */}
      {s ? (
        <Section title="SSL / TLS Certificate" icon={Shield} defaultOpen={true}>
          <div className="grid md:grid-cols-3 gap-4">
            <div><h4 className="text-sm font-medium mb-3 text-[var(--foreground)]">Overview</h4>
              <InfoRow label="Valid" value={s.valid ? "✅ Valid" : "❌ Invalid"} warn={!s.valid} />
              <InfoRow label="Subject" value={s.subjectName} />
              <InfoRow label="Issuer" value={s.issuer} />
              <InfoRow label="Issued By" value={s.issuedBy} />
              <InfoRow label="Self-Signed" value={s.selfSigned ? "⚠️ Yes" : "✅ No"} warn={!!s.selfSigned} />
              <InfoRow label="CA" value={s.isCA ? "Yes" : "No"} />
            </div>
            <div><h4 className="text-sm font-medium mb-3 text-[var(--foreground)]">Validity</h4>
              <InfoRow label="Valid From" value={s.validFrom ? formatDateAbsolute(s.validFrom) : "—"} />
              <InfoRow label="Valid To" value={s.validTo ? formatDateAbsolute(s.validTo) : "—"} />
              <InfoRow label="Days Remaining" value={sslDays !== null ? sslDays < 0 ? "⚠️ Expired" : `${sslDays} days` : "—"} warn={sslDays !== null && sslDays < 30} />
              <InfoRow label="Serial Number" value={s.serialNumber} mono />
            </div>
            <div><h4 className="text-sm font-medium mb-3 text-[var(--foreground)]">Technical</h4>
              <InfoRow label="Protocol" value={s.protocol} />
              <InfoRow label="Cipher Suite" value={s.cipherSuite} />
              <InfoRow label="Key Exchange" value={s.keyExchange} />
              <InfoRow label="Key Algorithm" value={s.keyAlgorithm} />
              <InfoRow label="Key Size" value={s.keySize ? `${s.keySize} bits` : "—"} />
              <InfoRow label="Signature Algorithm" value={s.signatureAlgorithm} />
            </div>
          </div>
          <div className="grid md:grid-cols-2 gap-4 mt-4">
            <div><h4 className="text-sm font-medium mb-3 text-[var(--foreground)]">Subject Alt Names (SAN)</h4>
              {s.dnsNames ? (() => { let dn: string[]; try { dn = JSON.parse(s.dnsNames) } catch { dn = [] }; return <>
                {dn.map((d, i) => <div key={i} className="flex items-center gap-2 text-xs font-mono text-[var(--foreground)] py-0.5"><Globe className="w-3 h-3 text-[var(--primary)]" />{d}</div>)}
              </> })() : <p className="text-xs text-[var(--muted-foreground)]">No SAN data</p>}
            </div>
            <div><h4 className="text-sm font-medium mb-3 text-[var(--foreground)]">Fingerprints</h4>
              <InfoRow label="SHA-1" value={s.fingerprint} mono />
              <InfoRow label="SHA-256" value={s.fingerprint256} mono />
            </div>
          </div>
          {s.certificateChain ? (() => {
            let chain: any[]; try { chain = JSON.parse(s.certificateChain) } catch { chain = [] }
            return chain.length > 0 ? (
              <div className="mt-4"><h4 className="text-sm font-medium mb-3 text-[var(--foreground)]">Certificate Chain ({chain.length} certificates)</h4>
                {chain.map((cert: any, i: number) => (
                  <div key={i} className="p-3 rounded-lg bg-[var(--secondary)] mb-2">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs font-bold text-[var(--primary)]">#{i + 1}</span>
                      {i === 0 && <Badge variant="online">Leaf</Badge>}
                      {i === chain.length - 1 && <Badge variant="warning">Root</Badge>}
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <span className="text-[var(--muted-foreground)]">Subject:</span>
                      <span className="font-mono text-[var(--foreground)]">{cert.subject?.CN || "—"}</span>
                      <span className="text-[var(--muted-foreground)]">Issuer:</span>
                      <span className="font-mono text-[var(--foreground)]">{cert.issuer?.CN || "—"}</span>
                      <span className="text-[var(--muted-foreground)]">Valid:</span>
                      <span className="font-mono text-[var(--foreground)]">{cert.valid_from?.slice(0, 10)} → {cert.valid_to?.slice(0, 10)}</span>
                      <span className="text-[var(--muted-foreground)]">Serial:</span>
                      <span className="font-mono text-[var(--foreground)] text-[10px] break-all">{cert.serialNumber}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : null
          })() : null}
          {s.ocspUrls && (() => {
            let urls: string[]; try { urls = JSON.parse(s.ocspUrls) } catch { urls = [] }
            return urls.length > 0 ? <div className="mt-4"><h4 className="text-sm font-medium mb-2 text-[var(--foreground)]">OCSP & CRL</h4>
              {urls.map((u, i) => <InfoRow key={i} label="OCSP URL" value={u} mono />)}
            </div> : null
          })()}
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

      {/* INCIDENTS */}
      {website.incidents?.length > 0 ? (
        <Section title="Incident History" icon={AlertTriangle}>
          {website.incidents.map((inc: Incident) => (
            <div key={inc.id} className="flex items-center justify-between p-3 rounded-lg bg-[var(--secondary)] mb-2 last:mb-0">
              <div className="flex items-center gap-3">
                <div className={`w-2.5 h-2.5 rounded-full ${inc.resolved ? "bg-emerald-500" : "bg-red-500 animate-pulse"}`} />
                <div><p className="text-sm font-medium text-[var(--foreground)]">{inc.resolved ? "Recovered" : "Website Down"}</p>
                  <p className="text-xs text-[var(--muted-foreground)]">{formatDateAbsolute(inc.startedAt)}</p>
                </div>
              </div>
              <div className="text-right"><p className="text-sm font-semibold text-[var(--foreground)]">{inc.duration ? formatDuration(inc.duration) : "Ongoing"}</p>
                {inc.endedAt ? <p className="text-xs text-[var(--muted-foreground)]">{formatDateAbsolute(inc.endedAt)}</p> : null}
              </div>
            </div>
          ))}
        </Section>
      ) : null}

      {/* CHECK LOG */}
      <Card>
        <CardHeader><CardTitle>Full Check Log</CardTitle>
          <div className="flex items-center gap-1 text-xs text-[var(--muted-foreground)]"><Layers className="w-3 h-3" />{allChecks.length} checks</div>
        </CardHeader>
        <div className="overflow-x-auto max-h-96 overflow-y-auto">
          <table className="w-full text-xs">
            <thead><tr className="border-b border-[var(--border)]">
              {["Time","Status","Code","Total","DNS","TCP","TLS","TTFB","DL","Size","Server","IP"].map(h => (
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
                <td className="py-1 px-2">{ch.contentLength ? `${(ch.contentLength / 1024).toFixed(0)}k` : "—"}</td>
                <td className="py-1 px-2">{ch.server || "—"}</td>
                <td className="py-1 px-2 text-[10px]">{ch.primaryIp || "—"}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
