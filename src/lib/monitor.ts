import https from "https"
import http from "http"
import tls from "tls"
import dns from "dns"
import { URL } from "url"
import { prisma } from "@/lib/prisma"

interface CheckContext {
  timings: {
    dns: number
    tcp: number
    tls: number
    ttfb: number
    download: number
  }
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
  // HSTS
  if (headers["strict-transport-security"]) {
    const val = headers["strict-transport-security"]
    analysis.hsts = { present: true, value: val, maxAge: parseInt(val.match(/max-age=(\d+)/)?.[1] || "0") }
    analysis.hsts.includeSubDomains = val.includes("includeSubDomains")
    analysis.hsts.preload = val.includes("preload")
  } else {
    analysis.hsts = { present: false }
  }
  // CSP
  if (headers["content-security-policy"]) {
    analysis.csp = { present: true, value: headers["content-security-policy"] }
  } else {
    analysis.csp = { present: false }
  }
  // X-Frame-Options
  analysis.xFrameOptions = headers["x-frame-options"] || null
  // X-Content-Type-Options
  analysis.xContentTypeOptions = headers["x-content-type-options"] || null
  // Referrer-Policy
  analysis.referrerPolicy = headers["referrer-policy"] || null
  // Permissions-Policy
  analysis.permissionsPolicy = headers["permissions-policy"] || null
  // CORS
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
  // Title
  const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i)
  if (titleMatch) meta.title = titleMatch[1].trim()
  // Meta tags
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
  // Canonical
  const canonMatch = html.match(/<link[^>]+rel\s*=\s*["']canonical["'][^>]+href\s*=\s*["']([^"']+)["']/i)
  if (canonMatch) meta.canonical = canonMatch[1]
  // Favicon
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

  return new Promise((resolve, reject) => {
    // DNS resolution
    const dnsStart = Date.now()
    dns.resolve4(url.hostname, (dnsErr, addresses) => {
      timings.dns = Date.now() - dnsStart
      if (!dnsErr && addresses.length > 0) {
        resolvedIps = addresses
        primaryIp = addresses[0]
        ipVersion = "IPv4"
      }

      const options: http.RequestOptions & { rejectUnauthorized?: boolean } = {
        hostname: url.hostname,
        port: parseInt(url.port) || (isHttps ? 443 : 80),
        path: url.pathname + url.search,
        method: "GET",
        timeout: 30000,
        rejectUnauthorized: false,
        family: 4,
        headers: {
          "User-Agent": "21by7-Monitor/2.0 (Comprehensive Website Monitor)",
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.5",
          "Accept-Encoding": "gzip, deflate, br",
          Connection: "close",
          "Cache-Control": "no-cache",
          Pragma: "no-cache",
        },
      }

      const mod = isHttps ? https : http
      const req = mod.request(options)

      // Track socket events for timing
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

        // Handle redirects
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
            timings,
            dnsRecords: {} as any,
            resolvedIps,
            httpVersion,
            method: options.method || "GET",
            statusCode,
            statusMessage,
            responseHeaders,
            requestHeaders,
            body,
            redirectChain: redirects,
            finalUrl: redirects.length > 0 ? redirects[redirects.length - 1] || urlStr : urlStr,
            primaryIp,
            ipVersion,
            cookies: parseCookies(responseHeaders),
            errorMessage: null,
          })
        })
      })

      req.on("error", (err: NodeJS.ErrnoException) => {
        const message = `[${err.code}] ${err.message}`
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
    })
  })
}

async function getFullCertChain(hostname: string, port = 443): Promise<any> {
  return new Promise((resolve) => {
    const socket = tls.connect(port, hostname, {
      rejectUnauthorized: false,
    }, () => {
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
            subject: current.subject,
            issuer: current.issuer,
            valid_from: current.valid_from,
            valid_to: current.valid_to,
            serialNumber: current.serialNumber,
            fingerprint: current.fingerprint,
            fingerprint256: current.fingerprint256,
          })
        }
        current = current.issuerCertificate
        if (!current || current === cert) break
        if (chain.length > 10) break
      }

      resolve({
        cert,
        cipher,
        protocol,
        chain,
        ocspStapled: ocsp,
      })
    })
    socket.on("error", () => resolve(null))
    socket.setTimeout(10000, () => { socket.destroy(); resolve(null) })
  })
}

export async function performCheck(websiteId: string) {
  const website = await prisma.website.findUnique({ where: { id: websiteId } })
  if (!website) return

  const url = website.url
  const parsed = new URL(url)

  // Parallel DNS + HTTP check
  const [dnsRecords, httpResult] = await Promise.all([
    resolveAllDns(parsed.hostname).catch(() => ({})),
    performDetailedHttpRequest(url).catch(() => null),
  ])

  if (!httpResult) {
    await prisma.websiteCheck.create({
      data: { websiteId, status: "offline", errorMessage: "Failed to establish connection" },
    })
    await prisma.website.update({ where: { id: websiteId }, data: { status: "offline" } })
    return null
  }

  const status = httpResult.statusCode >= 200 && httpResult.statusCode < 500 ? "online" : "offline"
  const totalTime = httpResult.timings.dns + httpResult.timings.ttfb + httpResult.timings.download
  const pageMeta = extractPageMeta(httpResult.body)
  const securityHeaders = analyzeSecurityHeaders(httpResult.responseHeaders)
  const compression = httpResult.responseHeaders["content-encoding"] || null

  // Determine charset
  const ct = httpResult.responseHeaders["content-type"] || ""
  const charsetMatch = ct.match(/charset=([^;\s]+)/i)
  const charset = charsetMatch ? charsetMatch[1] : null

  // Create check record
  await prisma.websiteCheck.create({
    data: {
      websiteId,
      status,
      statusCode: httpResult.statusCode || null,
      statusMessage: httpResult.statusMessage || null,
      responseTime: totalTime,
      errorMessage: httpResult.errorMessage,
      dnsTime: httpResult.timings.dns || null,
      tcpTime: httpResult.timings.tcp || null,
      tlsTime: httpResult.timings.tls || null,
      ttfb: httpResult.timings.ttfb || null,
      downloadTime: httpResult.timings.download || null,
      httpVersion: httpResult.httpVersion || null,
      method: httpResult.method || null,
      contentType: ct || null,
      contentLength: httpResult.responseHeaders["content-length"]
        ? parseInt(httpResult.responseHeaders["content-length"]) : null,
      contentEncoding: httpResult.responseHeaders["content-encoding"] || null,
      charset,
      compression,
      server: httpResult.responseHeaders["server"] || null,
      poweredBy: httpResult.responseHeaders["x-powered-by"] || null,
      redirectCount: httpResult.redirectChain.length || null,
      redirectChain: httpResult.redirectChain.length > 0 ? httpResult.redirectChain.join(" → ") : null,
      finalUrl: httpResult.finalUrl || null,
      resolvedIps: httpResult.resolvedIps.length > 0 ? JSON.stringify(httpResult.resolvedIps) : null,
      dnsRecords: dnsRecords ? JSON.stringify(dnsRecords) : null,
      requestHeaders: httpResult.requestHeaders ? JSON.stringify(httpResult.requestHeaders) : null,
      responseHeaders: httpResult.responseHeaders ? JSON.stringify(httpResult.responseHeaders) : null,
      securityHeaders: JSON.stringify(securityHeaders),
      cookies: Object.keys(httpResult.cookies).length > 0 ? JSON.stringify(httpResult.cookies) : null,
      corsHeaders: JSON.stringify(securityHeaders.cors),
      pageTitle: pageMeta.title,
      metaDescription: pageMeta.description,
      metaKeywords: pageMeta.keywords,
      canonicalUrl: pageMeta.canonical,
      ogTitle: pageMeta.ogTitle,
      ogDescription: pageMeta.ogDescription,
      ogImage: pageMeta.ogImage,
      robotsTag: pageMeta.robots,
      faviconUrl: pageMeta.favicon,
      hsts: securityHeaders.hsts?.present || false,
      xFrameOptions: securityHeaders.xFrameOptions,
      contentSecurityPolicy: securityHeaders.csp?.value || null,
      bodyPreview: httpResult.body.slice(0, 3000) || null,
      primaryIp: httpResult.primaryIp || null,
      ipVersion: httpResult.ipVersion || null,
    },
  })

  // Incident detection
  const previousStatus = website.status
  if (status === "offline" && previousStatus === "online") {
    await prisma.incident.create({ data: { websiteId, startedAt: new Date(), resolved: false } })
  }
  if (status === "online" && previousStatus === "offline") {
    const active = await prisma.incident.findFirst({
      where: { websiteId, resolved: false }, orderBy: { startedAt: "desc" },
    })
    if (active) {
      const duration = Math.floor((Date.now() - active.startedAt.getTime()) / 1000)
      await prisma.incident.update({ where: { id: active.id }, data: { endedAt: new Date(), duration, resolved: true } })
    }
  }

  await prisma.website.update({ where: { id: websiteId }, data: { status } })

  return {
    status, statusCode: httpResult.statusCode, responseTime: totalTime,
    timings: httpResult.timings, httpVersion: httpResult.httpVersion,
    server: httpResult.responseHeaders["server"],
    primaryIp: httpResult.primaryIp,
    pageTitle: pageMeta.title,
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
        checkedAt: new Date(),
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
      },
    })

    return { valid, expiryDate, protocol, cipher: cipher?.name, subject: cert.subject?.CN, chain: chain?.length }
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
