import https from "https"
import http from "http"
import tls from "tls"
import dns from "dns"
import net from "net"
import { URL } from "url"
import { prisma } from "@/lib/prisma"
import crypto from "crypto"
import { isInMaintenance } from "@/services/maintenance.service"
import { checkKeywords } from "@/services/keyword.service"
import { checkExternalProvider } from "@/services/external-monitor.service"
import { sendWebhook } from "@/services/webhook.service"
import { detectAnomaly } from "@/services/anomaly.service"

interface CheckContext {
  timings: { dns: number; tcp: number; tls: number; ttfb: number; download: number }
  dnsRecords: { a?: string[]; aaaa?: string[]; mx?: string[]; ns?: string[]; txt?: string[]; cname?: string }
  resolvedIps: string[]
  httpVersion: string
  method: string
  statusCode: number
  statusMessage: string
  responseHeaders: Record<string, string>
  requestHeaders: Record<string, string>
  body: string
  redirectChain: string[]
  finalUrl: string
  primaryIp: string
  ipVersion: string
  cookies: Record<string, string>
  errorMessage: string | null
}

const REGIONS = [
  { id: "us-east", name: "US East" },
  { id: "eu-west", name: "EU West" },
  { id: "ap-south", name: "Asia Pacific" },
]

function parseCookies(headers: Record<string, string>): Record<string, string> {
  const cookies: Record<string, string> = {}
  const setCookie = headers["set-cookie"]
  if (setCookie) {
    for (const entry of (Array.isArray(setCookie) ? setCookie : [setCookie])) {
      const parts = entry.split(";")[0].split("=")
      if (parts.length >= 2) cookies[parts[0].trim()] = parts.slice(1).join("=")
    }
  }
  return cookies
}

function analyzeSecurityHeaders(headers: Record<string, string>) {
  const analysis: Record<string, any> = {}
  if (headers["strict-transport-security"]) {
    const val = headers["strict-transport-security"]
    analysis.hsts = { present: true, value: val, maxAge: parseInt(val.match(/max-age=(\d+)/)?.[1] || "0") }
    analysis.hsts.includeSubDomains = val.includes("includeSubDomains")
    analysis.hsts.preload = val.includes("preload")
  } else {
    analysis.hsts = { present: false }
  }
  if (headers["content-security-policy"]) {
    analysis.csp = { present: true, value: headers["content-security-policy"] }
  } else {
    analysis.csp = { present: false }
  }
  analysis.xFrameOptions = headers["x-frame-options"] || null
  analysis.xContentTypeOptions = headers["x-content-type-options"] || null
  analysis.referrerPolicy = headers["referrer-policy"] || null
  analysis.permissionsPolicy = headers["permissions-policy"] || null
  analysis.cors = {
    allowOrigin: headers["access-control-allow-origin"] || null,
    allowMethods: headers["access-control-allow-methods"] || null,
    allowHeaders: headers["access-control-allow-headers"] || null,
    allowCredentials: headers["access-control-allow-credentials"] || null,
  }
  return analysis
}

function extractPageMeta(html: string) {
  const meta: Record<string, string | null> = {
    title: null, description: null, keywords: null,
    ogTitle: null, ogDescription: null, ogImage: null,
    canonical: null, robots: null, favicon: null,
  }
  const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i)
  if (titleMatch) meta.title = titleMatch[1].trim()
  const metaTags = html.matchAll(/<meta[^>]+>/gi)
  for (const m of metaTags) {
    const name = (m[0].match(/name\s*=\s*["']([^"']+)["']/i) || [])[1]?.toLowerCase()
    const property = (m[0].match(/property\s*=\s*["']([^"']+)["']/i) || [])[1]?.toLowerCase()
    const content = (m[0].match(/content\s*=\s*["']([^"']+)["']/i) || [])[1]
    const key = name || property
    if (!key || !content) continue
    if (key === "description") meta.description = content
    if (key === "keywords") meta.keywords = content
    if (key === "og:title") meta.ogTitle = content
    if (key === "og:description") meta.ogDescription = content
    if (key === "og:image") meta.ogImage = content
    if (key === "robots") meta.robots = content
  }
  const canonMatch = html.match(/<link[^>]+rel\s*=\s*["']canonical["'][^>]+href\s*=\s*["']([^"']+)["']/i)
  if (canonMatch) meta.canonical = canonMatch[1]
  const favMatch = html.match(/<link[^>]+rel\s*=\s*["'](?:shortcut )?icon["'][^>]+href\s*=\s*["']([^"']+)["']/i)
  if (favMatch) meta.favicon = favMatch[1]
  return meta
}

async function resolveAllDns(hostname: string) {
  const records: Record<string, any> = { a: [], aaaa: [], mx: [], ns: [], txt: [], cname: null }
  const promises = [
    dns.promises.resolve4(hostname).then(r => records.a = r).catch(() => {}),
    dns.promises.resolve6(hostname).then(r => records.aaaa = r).catch(() => {}),
    dns.promises.resolveMx(hostname).then(r => records.mx = r.map(m => `${m.priority} ${m.exchange}`)).catch(() => {}),
    dns.promises.resolveNs(hostname).then(r => records.ns = r).catch(() => {}),
    dns.promises.resolveTxt(hostname).then(r => records.txt = r.map(t => t.join(" "))).catch(() => {}),
    dns.promises.resolveCname(hostname).then(r => records.cname = r).catch(() => {}),
  ]
  await Promise.all(promises)
  return records
}

async function performDetailedHttpRequest(urlStr: string, redirects: string[] = [], maxRedirects = 5): Promise<CheckContext> {
  const url = new URL(urlStr)
  const isHttps = url.protocol === "https:"

  const timings = { dns: 0, tcp: 0, tls: 0, ttfb: 0, download: 0 }
  let httpVersion = ""
  let primaryIp = ""
  let ipVersion = ""
  let resolvedIps: string[] = []

  const browserUserAgents = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:128.0) Gecko/20100101 Firefox/128.0",
  ]
  const userAgent = browserUserAgents[Math.floor(Math.random() * browserUserAgents.length)]

  return new Promise((resolve, reject) => {
    const dnsStart = Date.now()
    let dnsFinished = false

    const onDnsDone = (dnsErr: NodeJS.ErrnoException | null, addresses: string[]) => {
      if (dnsFinished) return
      timings.dns = Date.now() - dnsStart
      if (!dnsErr && addresses.length > 0) {
        resolvedIps = addresses
        primaryIp = addresses[0]
        ipVersion = addresses[0].includes(":") ? "IPv6" : "IPv4"
      }
      dnsFinished = true
      onDnsReady()
    }

    const onDnsReady = () => {
      const options: http.RequestOptions & { rejectUnauthorized?: boolean; autoSelectFamily?: boolean } = {
        hostname: url.hostname,
        port: parseInt(url.port) || (isHttps ? 443 : 80),
        path: url.pathname + url.search,
        method: "GET",
        timeout: 60000,
        rejectUnauthorized: false,
        autoSelectFamily: true,
        headers: {
          "User-Agent": userAgent,
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.9",
          "Accept-Encoding": "gzip, deflate, br",
          Connection: "keep-alive",
          "Upgrade-Insecure-Requests": "1",
          "Sec-Fetch-Dest": "document",
          "Sec-Fetch-Mode": "navigate",
          "Sec-Fetch-Site": "none",
          "Sec-Fetch-User": "?1",
          "Sec-Ch-Ua": '"Chromium";v="137", "Not/A)Brand";v="24", "Google Chrome";v="137"',
          "Sec-Ch-Ua-Mobile": "?0",
          "Sec-Ch-Ua-Platform": '"Windows"',
          "Cache-Control": "max-age=0",
        },
      }

      const mod = isHttps ? https : http
      const req = mod.request(options)

      req.on("socket", (socket) => {
        const tcpStart = Date.now()
        socket.on("connect", () => {
          timings.tcp = Date.now() - tcpStart
        })
        if (isHttps) {
          socket.on("secureConnect", () => {
            timings.tls = Date.now() - tcpStart
            const sslSocket = socket as tls.TLSSocket
            httpVersion = sslSocket.getProtocol() || ""
          })
        }
        socket.on("lookup", (err, address, family) => {
          if (address) { primaryIp = address; ipVersion = `IPv${family}` }
        })
      })

      let body = ""
      let ttfbRecorded = false

      req.on("response", (res) => {
        if (!timings.tcp) timings.tcp = Date.now() - dnsStart
        if (!timings.tls && isHttps) timings.tls = timings.tcp
        httpVersion = httpVersion || `HTTP/${res.httpVersionMajor}.${res.httpVersionMinor}`
        const statusCode = res.statusCode || 0
        const statusMessage = res.statusMessage || ""
        const responseHeaders: Record<string, string> = {}
        for (const [k, v] of Object.entries(res.headers)) {
          responseHeaders[k] = Array.isArray(v) ? v.join(", ") : (v as string)
        }

        if (statusCode >= 301 && statusCode <= 308 && responseHeaders.location && redirects.length < maxRedirects) {
          const location = responseHeaders.location.startsWith("http")
            ? responseHeaders.location
            : `${url.protocol}//${url.host}${responseHeaders.location}`
          res.resume()
          performDetailedHttpRequest(location, [...redirects, location], maxRedirects)
            .then(resolve).catch(reject)
          return
        }

        res.on("data", (chunk: Buffer) => {
          if (!ttfbRecorded) {
            timings.ttfb = Date.now() - dnsStart
            ttfbRecorded = true
          }
          body += chunk.toString("utf8").slice(0, 10000)
        })

        res.on("end", () => {
          if (!ttfbRecorded) timings.ttfb = Date.now() - dnsStart
          timings.download = Date.now() - dnsStart - timings.ttfb
          const requestHeaders = { ...options.headers } as Record<string, string>

          resolve({
            timings, dnsRecords: {} as any, resolvedIps, httpVersion,
            method: options.method || "GET", statusCode, statusMessage,
            responseHeaders, requestHeaders, body,
            redirectChain: redirects,
            finalUrl: redirects.length > 0 ? redirects[redirects.length - 1] || urlStr : urlStr,
            primaryIp, ipVersion, cookies: parseCookies(responseHeaders), errorMessage: null,
          })
        })
      })

      req.on("error", (err: NodeJS.ErrnoException) => {
        const code = (err as any).code || "UNKNOWN"
        const message = `[${code}] ${err.message}`
        resolve({
          timings, dnsRecords: {} as any, resolvedIps, httpVersion: "", method: "GET",
          statusCode: 0, statusMessage: "", responseHeaders: {}, requestHeaders: {},
          body: "", redirectChain: redirects, finalUrl: urlStr,
          primaryIp, ipVersion, cookies: {}, errorMessage: message,
        })
      })

      req.on("timeout", () => {
        req.destroy()
        resolve({
          timings, dnsRecords: {} as any, resolvedIps, httpVersion: "", method: "GET",
          statusCode: 0, statusMessage: "", responseHeaders: {}, requestHeaders: {},
          body: "", redirectChain: redirects, finalUrl: urlStr,
          primaryIp, ipVersion, cookies: {}, errorMessage: "[TIMEOUT] Request timed out",
        })
      })

      req.end()
    }

    dns.promises.resolve4(url.hostname).then(
      (addrs: string[]) => onDnsDone(null, addrs),
      (err: NodeJS.ErrnoException) => {
        dns.promises.resolve6(url.hostname).then(
          (addrs: string[]) => onDnsDone(null, addrs),
          () => onDnsDone(err, [])
        )
      }
    )
  })
}

async function getFullCertChain(hostname: string, port = 443): Promise<any> {
  return new Promise((resolve) => {
    const socket = tls.connect(port, hostname, { rejectUnauthorized: false }, () => {
      const cert = socket.getPeerCertificate(true)
      const cipher = socket.getCipher()
      const protocol = socket.getProtocol()
      const ocsp = (socket as any).isSessionReused ? false : null
      socket.end()

      const chain = []
      let current: any = cert
      while (current) {
        if (current.subject && current.issuer) {
          chain.push({
            subject: current.subject, issuer: current.issuer,
            valid_from: current.valid_from, valid_to: current.valid_to,
            serialNumber: current.serialNumber,
            fingerprint: current.fingerprint, fingerprint256: current.fingerprint256,
          })
        }
        current = current.issuerCertificate
        if (!current || current === cert) break
        if (chain.length > 10) break
      }

      resolve({ cert, cipher, protocol, chain, ocspStapled: ocsp })
    })
    socket.on("error", () => resolve(null))
    socket.setTimeout(10000, () => { socket.destroy(); resolve(null) })
  })
}

function normalizeUrl(raw: string): string {
  let url = raw.trim()
  if (!/^https?:\/\//i.test(url)) url = "https://" + url
  url = url.replace(/\/+$/, "")
  return url
}

function simplePing(url: string): Promise<{ ok: boolean; time: number; code: number } | null> {
  return new Promise((resolve) => {
    const start = Date.now()
    const mod = url.startsWith("https") ? https : http
    const req = mod.get(url, { timeout: 15000, rejectUnauthorized: false }, (res) => {
      const time = Date.now() - start
      res.resume()
      resolve({ ok: res.statusCode !== undefined, time, code: res.statusCode || 0 })
    })
    req.on("error", () => resolve(null))
    req.on("timeout", () => { req.destroy(); resolve(null) })
  })
}

async function performTcpCheck(host: string, port: number): Promise<{ status: string; responseTime: number; errorMessage: string | null }> {
  return new Promise((resolve) => {
    const start = Date.now()
    const socket = net.createConnection({ host, port, timeout: 15000 }, () => {
      const responseTime = Date.now() - start
      socket.end()
      resolve({ status: "online", responseTime, errorMessage: null })
    })
    socket.on("error", (err: any) => {
      resolve({ status: "offline", responseTime: Date.now() - start, errorMessage: `[${err.code || "UNKNOWN"}] ${err.message}` })
    })
    socket.on("timeout", () => {
      socket.destroy()
      resolve({ status: "offline", responseTime: Date.now() - start, errorMessage: "[TIMEOUT] TCP connection timed out" })
    })
  })
}

async function performPingCheck(host: string): Promise<{ status: string; responseTime: number; errorMessage: string | null }> {
  return new Promise((resolve) => {
    const start = Date.now()
    dns.resolve4(host, (err) => {
      const responseTime = Date.now() - start
      if (err) {
        resolve({ status: "offline", responseTime, errorMessage: `DNS resolution failed: ${err.message}` })
      } else {
        resolve({ status: "online", responseTime, errorMessage: null })
      }
    })
  })
}

async function performDnsCheck(host: string): Promise<{ status: string; responseTime: number; errorMessage: string | null }> {
  return new Promise((resolve) => {
    const start = Date.now()
    dns.promises.resolve4(host).then((addresses) => {
      const responseTime = Date.now() - start
      if (addresses.length > 0) {
        resolve({ status: "online", responseTime, errorMessage: null })
      } else {
        resolve({ status: "offline", responseTime, errorMessage: "No A records found" })
      }
    }).catch((err) => {
      resolve({ status: "offline", responseTime: Date.now() - start, errorMessage: err.message })
    })
  })
}

async function checkSSLWithDetails(hostname: string): Promise<{
  weakProtocol: boolean; weakCipher: boolean; valid: boolean; expiryDate: Date | null
} | null> {
  try {
    const result = await getFullCertChain(hostname)
    if (!result || !result.cert?.valid_to) return null

    const { cert, cipher, protocol } = result
    const expiryDate = new Date(cert.valid_to)
    const valid = expiryDate > new Date()

    const weakProtocol = !!(protocol && (protocol.includes("TLSv1") && !protocol.includes("TLSv1.2") && !protocol.includes("TLSv1.3")))
    const weakCipher = !!(cipher && (cipher.name.includes("RC4") || cipher.name.includes("DES") || cipher.name.includes("NULL") || cipher.keyLength < 128))

    return { weakProtocol, weakCipher, valid, expiryDate }
  } catch {
    return null
  }
}

async function checkSSLLayeredAlerts(websiteId: string, sslInfo: { valid: boolean; expiryDate: Date | null }) {
  if (!sslInfo.expiryDate) return

  const daysLeft = Math.floor((sslInfo.expiryDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))

  const alerts: { level: string; message: string }[] = []
  if (!sslInfo.valid) alerts.push({ level: "critical", message: "SSL certificate is expired" })
  else if (daysLeft < 1) alerts.push({ level: "critical", message: "SSL certificate expires today" })
  else if (daysLeft < 7) alerts.push({ level: "high", message: `SSL certificate expires in ${daysLeft} days` })
  else if (daysLeft < 14) alerts.push({ level: "medium", message: `SSL certificate expires in ${daysLeft} days` })
  else if (daysLeft < 30) alerts.push({ level: "low", message: `SSL certificate expires in ${daysLeft} days` })

  for (const alert of alerts) {
    const existing = await prisma.notification.findFirst({
      where: { websiteId, type: "ssl_alert", message: { contains: alert.message } },
    })
    if (!existing) {
      await prisma.notification.create({
        data: { websiteId, type: "ssl_alert", message: alert.message, severity: alert.level },
      })
    }
  }
}

function getSensitivityThreshold(sensitivity: string): number {
  switch (sensitivity) {
    case "strict": return 1
    case "relaxed": return 3
    case "normal":
    default: return 2
  }
}

function determineSeverity(statusCode: number, errorMessage: string | null): string {
  if (!statusCode || statusCode === 0) return "critical"
  if (statusCode >= 500) return "critical"
  if (statusCode >= 400) return "major"
  if (errorMessage?.includes("TIMEOUT")) return "major"
  return "minor"
}

export async function performCheck(websiteId: string) {
  const website = await prisma.website.findUnique({ where: { id: websiteId } })
  if (!website) return

  const rawUrl = website.url
  const url = normalizeUrl(rawUrl)
  const monitorType = website.monitorType || "http"

  let parsed: URL
  try { parsed = new URL(url) } catch {
    const errMsg = `Invalid URL: ${rawUrl}`
    await prisma.websiteCheck.create({
      data: { websiteId, status: "offline", errorMessage: errMsg },
    })
    await prisma.website.update({ where: { id: websiteId }, data: { status: "offline", consecutiveFailures: { increment: 1 } } })
    return null
  }

  let status = "offline"
  let statusCode = 0
  let responseTime = 0
  let errorMessage: string | null = null
  let httpResult: CheckContext | null = null

  if (monitorType === "tcp") {
    const port = parseInt(parsed.port) || (parsed.protocol === "https:" ? 443 : 80)
    const tcpResult = await performTcpCheck(parsed.hostname, port)
    status = tcpResult.status
    responseTime = tcpResult.responseTime
    errorMessage = tcpResult.errorMessage
    statusCode = status === "online" ? 200 : 0
  } else if (monitorType === "ping") {
    const pingResult = await performPingCheck(parsed.hostname)
    status = pingResult.status
    responseTime = pingResult.responseTime
    errorMessage = pingResult.errorMessage
    statusCode = status === "online" ? 200 : 0
  } else if (monitorType === "dns") {
    const dnsResult = await performDnsCheck(parsed.hostname)
    status = dnsResult.status
    responseTime = dnsResult.responseTime
    errorMessage = dnsResult.errorMessage
    statusCode = status === "online" ? 200 : 0
  } else {
    let lastError: string | null = null

    for (let attempt = 1; attempt <= 3; attempt++) {
      httpResult = await performDetailedHttpRequest(url).catch((e) => { lastError = e.message; return null })
      if (httpResult) break
      if (attempt < 3) await new Promise(r => setTimeout(r, 3000 * attempt))
    }

    if (!httpResult && url.startsWith("https://")) {
      const httpUrl = "http://" + url.slice(8)
      httpResult = await performDetailedHttpRequest(httpUrl).catch(() => null)
      if (httpResult) lastError = null
    }

    if (!httpResult) {
      const ping = await simplePing(url)
      if (ping) {
        httpResult = {
          timings: { dns: 0, tcp: 0, tls: 0, ttfb: ping.time, download: 0 },
          dnsRecords: {} as any, resolvedIps: [], httpVersion: "", method: "GET",
          statusCode: ping.code, statusMessage: "", responseHeaders: {},
          requestHeaders: {}, body: "", redirectChain: [], finalUrl: url,
          primaryIp: "", ipVersion: "", cookies: {}, errorMessage: null,
        }
      } else if (url.startsWith("https://")) {
        const altPing = await simplePing("http://" + url.slice(8))
        if (altPing) {
          httpResult = {
            timings: { dns: 0, tcp: 0, tls: 0, ttfb: altPing.time, download: 0 },
            dnsRecords: {} as any, resolvedIps: [], httpVersion: "", method: "GET",
            statusCode: altPing.code, statusMessage: "", responseHeaders: {},
            requestHeaders: {}, body: "", redirectChain: [], finalUrl: url,
            primaryIp: "", ipVersion: "", cookies: {}, errorMessage: null,
          }
        }
      }
    }

    if (!httpResult) {
      const externalResult = await checkExternalProvider(website.userId, url).catch(() => null)
      if (externalResult && (externalResult.status === "online" || externalResult.status === "offline")) {
        const extStatus = externalResult.status === "online" ? "online" : "offline"
        const extMsg = externalResult.status === "online"
          ? `Direct check failed (${lastError || "connection refused"}) but ${externalResult.provider} reports UP`
          : `Down — confirmed by ${externalResult.provider}`
        await prisma.websiteCheck.create({
          data: { websiteId, status: extStatus, statusCode: externalResult.statusCode || 0, responseTime: externalResult.responseTime || 0, errorMessage: extMsg },
        })
        const threshold = getSensitivityThreshold(website.sensitivity)
        if (extStatus === "offline") {
          const newFailures = website.consecutiveFailures + 1
          if (newFailures >= threshold && website.status === "online") {
            await prisma.website.update({ where: { id: websiteId }, data: { status: "offline", consecutiveFailures: newFailures } })
          } else {
            await prisma.website.update({ where: { id: websiteId }, data: { consecutiveFailures: newFailures } })
          }
        } else {
          await prisma.website.update({ where: { id: websiteId }, data: { consecutiveFailures: 0 } })
        }
        return null
      }

      errorMessage = lastError
        ? `${lastError} — site may be down or blocking our checks`
        : `Cannot reach ${url} — site may be down or blocking our checks`
      await prisma.websiteCheck.create({
        data: { websiteId, status: "offline", errorMessage },
      })
      const newFailures = website.consecutiveFailures + 1
      const threshold = getSensitivityThreshold(website.sensitivity)
      if (newFailures >= threshold && website.status === "online") {
        await prisma.website.update({ where: { id: websiteId }, data: { status: "offline", consecutiveFailures: newFailures } })
      } else {
        await prisma.website.update({ where: { id: websiteId }, data: { consecutiveFailures: newFailures } })
      }
      return null
    }

    status = httpResult.statusCode >= 200 && httpResult.statusCode < 500 ? "online" : "offline"
    statusCode = httpResult.statusCode
    responseTime = httpResult.timings.dns + httpResult.timings.ttfb + httpResult.timings.download || httpResult.timings.ttfb
    errorMessage = httpResult.errorMessage
  }

  // Smart alert threshold logic
  const previousStatus = website.status
  const previousFailures = website.consecutiveFailures
  const threshold = getSensitivityThreshold(website.sensitivity)

  let effectiveStatus = status

  if (status === "offline") {
    const newFailures = previousFailures + 1
    if (newFailures < threshold && previousStatus === "online") {
      effectiveStatus = "online"
      await prisma.website.update({ where: { id: websiteId }, data: { consecutiveFailures: newFailures } })
    } else {
      await prisma.website.update({ where: { id: websiteId }, data: { consecutiveFailures: newFailures } })
    }
  } else {
    await prisma.website.update({ where: { id: websiteId }, data: { consecutiveFailures: 0 } })
  }

  // Response time anomaly detection
  let isAnomaly = false
  let anomalyDeviation = 0
  if (status === "online" && responseTime > 0) {
    const anomalyResult = await detectAnomaly(websiteId, responseTime)
    isAnomaly = anomalyResult.isAnomaly
    anomalyDeviation = anomalyResult.deviation
  }

  if (monitorType === "http" && httpResult) {
    const pageMeta = extractPageMeta(httpResult.body)
    const securityHeaders = analyzeSecurityHeaders(httpResult.responseHeaders)
    const compression = httpResult.responseHeaders["content-encoding"] || null
    const ct = httpResult.responseHeaders["content-type"] || ""
    const charsetMatch = ct.match(/charset=([^;\s]+)/i)
    const charset = charsetMatch ? charsetMatch[1] : null
    const contentHash = httpResult.body ? crypto.createHash("md5").update(httpResult.body).digest("hex") : null
    const contentChanged = website.contentHash && contentHash ? website.contentHash !== contentHash : null

    await prisma.websiteCheck.create({
      data: {
        websiteId, status: effectiveStatus, statusCode, statusMessage: httpResult.statusMessage || null,
        responseTime, errorMessage,
        dnsTime: httpResult.timings.dns || null, tcpTime: httpResult.timings.tcp || null,
        tlsTime: httpResult.timings.tls || null, ttfb: httpResult.timings.ttfb || null,
        downloadTime: httpResult.timings.download || null,
        httpVersion: httpResult.httpVersion || null, method: httpResult.method || null,
        contentType: ct || null,
        contentLength: httpResult.responseHeaders["content-length"] ? parseInt(httpResult.responseHeaders["content-length"]) : null,
        contentEncoding: httpResult.responseHeaders["content-encoding"] || null,
        charset, compression, server: httpResult.responseHeaders["server"] || null,
        poweredBy: httpResult.responseHeaders["x-powered-by"] || null,
        redirectCount: httpResult.redirectChain.length || null,
        redirectChain: httpResult.redirectChain.length > 0 ? httpResult.redirectChain.join(" → ") : null,
        finalUrl: httpResult.finalUrl || null,
        resolvedIps: httpResult.resolvedIps.length > 0 ? JSON.stringify(httpResult.resolvedIps) : null,
        dnsRecords: httpResult.dnsRecords && Object.keys(httpResult.dnsRecords).length ? JSON.stringify(httpResult.dnsRecords) : null,
        requestHeaders: httpResult.requestHeaders ? JSON.stringify(httpResult.requestHeaders) : null,
        responseHeaders: httpResult.responseHeaders ? JSON.stringify(httpResult.responseHeaders) : null,
        securityHeaders: JSON.stringify(securityHeaders),
        cookies: Object.keys(httpResult.cookies).length > 0 ? JSON.stringify(httpResult.cookies) : null,
        corsHeaders: JSON.stringify(securityHeaders.cors),
        pageTitle: pageMeta.title, metaDescription: pageMeta.description,
        metaKeywords: pageMeta.keywords, canonicalUrl: pageMeta.canonical,
        ogTitle: pageMeta.ogTitle, ogDescription: pageMeta.ogDescription,
        ogImage: pageMeta.ogImage, robotsTag: pageMeta.robots, faviconUrl: pageMeta.favicon,
        hsts: securityHeaders.hsts?.present || false,
        xFrameOptions: securityHeaders.xFrameOptions,
        contentSecurityPolicy: securityHeaders.csp?.value || null,
        bodyPreview: httpResult.body.slice(0, 3000) || null,
        primaryIp: httpResult.primaryIp || null, ipVersion: httpResult.ipVersion || null,
        contentHash, contentChanged: contentChanged ?? null,
        isAnomaly, anomalyDeviation: anomalyDeviation || null,
      },
    })

    if (contentHash) {
      await prisma.website.update({ where: { id: websiteId }, data: { contentHash } })
    }

    if (httpResult.body) {
      const keywordAlerts = await checkKeywords(websiteId, httpResult.body).catch(() => [])
      for (const msg of keywordAlerts) {
        await prisma.notification.create({
          data: { websiteId, type: "keyword_alert", message: msg },
        })
      }
    }

    if (contentChanged) {
      await prisma.notification.create({
        data: { websiteId, type: "content_change", message: "Website content has changed" },
      })
    }
  } else {
    await prisma.websiteCheck.create({
      data: {
        websiteId, status: effectiveStatus, statusCode, responseTime, errorMessage,
        isAnomaly, anomalyDeviation: anomalyDeviation || null,
      },
    })
  }

  // SSL checks for HTTP monitors
  if (monitorType === "http") {
    const sslCheckResult = await checkSSLWithDetails(parsed.hostname)
    if (sslCheckResult) {
      await checkSSLLayeredAlerts(websiteId, sslCheckResult)
    }
  }

  // Incident detection with severity and timeline
  const inMaintenance = await isInMaintenance(websiteId)

  if (effectiveStatus === "offline" && previousStatus === "online" && !inMaintenance) {
    const severity = determineSeverity(statusCode, errorMessage)
    const incident = await prisma.incident.create({
      data: {
        websiteId, startedAt: new Date(), resolved: false, severity,
        rootCause: errorMessage || `HTTP ${statusCode}`,
      },
    })
    await prisma.incidentUpdate.create({
      data: { incidentId: incident.id, message: `Incident started: ${errorMessage || `Status code ${statusCode}`}`, status: "investigating" },
    })
  }

  if (effectiveStatus === "online" && previousStatus === "offline") {
    const active = await prisma.incident.findFirst({
      where: { websiteId, resolved: false }, orderBy: { startedAt: "desc" },
    })
    if (active) {
      const duration = Math.floor((Date.now() - active.startedAt.getTime()) / 1000)
      await prisma.incident.update({
        where: { id: active.id },
        data: { endedAt: new Date(), duration, resolved: true, impactSummary: `Downtime lasted ${Math.floor(duration / 60)}m ${duration % 60}s` },
      })
      await prisma.incidentUpdate.create({
        data: { incidentId: active.id, message: "Service recovered", status: "resolved" },
      })
    }
  }

  await prisma.website.update({ where: { id: websiteId }, data: { status: effectiveStatus } })

  // Send webhooks on status change
  if (previousStatus !== effectiveStatus && !inMaintenance) {
    const webhooks = await prisma.webhook.findMany({
      where: { websiteId, enabled: true },
    })
    const event = effectiveStatus === "offline" ? "down" : "up"
    for (const wh of webhooks) {
      if (wh.events.split(",").map(e => e.trim()).includes(event)) {
        sendWebhook(wh, event, {
          websiteName: website.name,
          websiteUrl: website.url,
          statusCode,
          responseTime,
          errorMessage: errorMessage || undefined,
        }).catch(() => {})
      }
    }

    await prisma.notification.create({
      data: {
        websiteId,
        type: effectiveStatus === "offline" ? "status_down" : "status_up",
        message: effectiveStatus === "offline"
          ? `Website went down: ${errorMessage || `Status ${statusCode}`}`
          : "Website is back online",
        severity: effectiveStatus === "offline" ? "critical" : "info",
      },
    })
  }

  if (isAnomaly) {
    await prisma.notification.create({
      data: {
        websiteId, type: "anomaly",
        message: `Response time anomaly detected: ${responseTime}ms (${anomalyDeviation.toFixed(1)} standard deviations above mean)`,
        severity: "warning",
      },
    })
  }

  return {
    status: effectiveStatus, statusCode, responseTime,
    timings: httpResult?.timings || { dns: 0, tcp: 0, tls: 0, ttfb: responseTime, download: 0 },
    httpVersion: httpResult?.httpVersion || "",
    server: httpResult?.responseHeaders?.["server"] || "",
    primaryIp: httpResult?.primaryIp || "",
    pageTitle: httpResult ? extractPageMeta(httpResult.body).title : null,
  }
}

export async function checkSSL(websiteId: string) {
  const website = await prisma.website.findUnique({ where: { id: websiteId } })
  if (!website) return

  try {
    const url = new URL(website.url)
    const result = await getFullCertChain(url.hostname)
    if (!result || !result.cert?.valid_to) return

    const { cert, cipher, protocol, chain, ocspStapled } = result
    const expiryDate = new Date(cert.valid_to)
    const validFrom = cert.valid_from ? new Date(cert.valid_from) : null
    const now = new Date()
    const valid = expiryDate > now

    const san = cert.subjectaltname ? cert.subjectaltname.split(", ") : []
    const dnsNames = san.filter((s: string) => s.startsWith("DNS:")).map((s: string) => s.replace("DNS:", ""))

    const weakProtocol = !!(protocol && (protocol.includes("TLSv1") && !protocol.includes("TLSv1.2") && !protocol.includes("TLSv1.3")))
    const weakCipher = !!(cipher && (cipher.name.includes("RC4") || cipher.name.includes("DES") || cipher.name.includes("NULL") || cipher.keyLength < 128))

    await prisma.sSL.upsert({
      where: { websiteId },
      update: {
        valid, expiryDate, validFrom, validTo: expiryDate,
        issuer: cert.issuer?.O || cert.issuer?.CN || null,
        subjectName: cert.subject?.CN || null,
        certificateChain: chain?.length > 0 ? JSON.stringify(chain) : null,
        issuedBy: cert.issuerCertificate?.subject?.CN || null,
        serialNumber: cert.serialNumber || null,
        fingerprint: cert.fingerprint || null,
        fingerprint256: cert.fingerprint256 || null,
        protocol: protocol || null,
        cipherSuite: cipher?.name || null,
        keyExchange: cipher?.version || null,
        keyAlgorithm: cert.pubkey?.algorithm || null,
        keySize: cert.pubkey?.size || null,
        signatureAlgorithm: cert.sigalg || null,
        san: san.length > 0 ? JSON.stringify(san) : null,
        dnsNames: dnsNames.length > 0 ? JSON.stringify(dnsNames) : null,
        isCA: cert.ca || false,
        selfSigned: !cert.issuerCertificate || cert.fingerprint === cert.issuerCertificate?.fingerprint,
        ocspStapled: ocspStapled ?? null,
        crlUrls: cert.crlDistributionPoints ? JSON.stringify(cert.crlDistributionPoints) : null,
        ocspUrls: JSON.stringify(cert.infoAccess?.OCSP || []),
        weakProtocol, weakCipher, checkedAt: new Date(),
      },
      create: {
        websiteId, valid, expiryDate, validFrom, validTo: expiryDate,
        issuer: cert.issuer?.O || cert.issuer?.CN || null,
        subjectName: cert.subject?.CN || null,
        certificateChain: chain?.length > 0 ? JSON.stringify(chain) : null,
        issuedBy: cert.issuerCertificate?.subject?.CN || null,
        serialNumber: cert.serialNumber || null,
        fingerprint: cert.fingerprint || null,
        fingerprint256: cert.fingerprint256 || null,
        protocol: protocol || null,
        cipherSuite: cipher?.name || null,
        keyExchange: cipher?.version || null,
        keyAlgorithm: cert.pubkey?.algorithm || null,
        keySize: cert.pubkey?.size || null,
        signatureAlgorithm: cert.sigalg || null,
        san: san.length > 0 ? JSON.stringify(san) : null,
        dnsNames: dnsNames.length > 0 ? JSON.stringify(dnsNames) : null,
        isCA: cert.ca || false,
        selfSigned: !cert.issuerCertificate || cert.fingerprint === cert.issuerCertificate?.fingerprint,
        ocspStapled: ocspStapled ?? null,
        crlUrls: cert.crlDistributionPoints ? JSON.stringify(cert.crlDistributionPoints) : null,
        ocspUrls: JSON.stringify(cert.infoAccess?.OCSP || []),
        weakProtocol, weakCipher,
      },
    })

    await checkSSLLayeredAlerts(websiteId, { valid, expiryDate })

    return { valid, expiryDate, protocol, cipher: cipher?.name, subject: cert.subject?.CN, chain: chain?.length, weakProtocol, weakCipher }
  } catch {
    return null
  }
}

export async function checkAllWebsites() {
  const websites = await prisma.website.findMany()
  const results = []
  for (const w of websites) {
    const r = await performCheck(w.id)
    results.push({ websiteId: w.id, result: r })
  }
  return results
}
