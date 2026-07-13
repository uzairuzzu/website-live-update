import { prisma } from "@/lib/prisma"
import dns from "dns"
import https from "https"
import http from "http"

export interface TrafficEstimate {
  trafficScore: number
  trafficLevel: "very_low" | "low" | "medium" | "high" | "very_high"
  estimatedDailyVisits: string
  confidence: "low" | "medium" | "high"
  signals: TrafficSignal[]
  techStack: TechInfo
  domainIntelligence: DomainIntel
  performanceInsights: PerformanceInsights
  contentInsights: ContentInsights
}

interface TrafficSignal {
  name: string
  score: number
  weight: number
  description: string
  icon: string
}

interface TechInfo {
  server: string | null
  poweredBy: string | null
  framework: string | null
  cdn: string | null
  caching: string | null
  ssl: string | null
  httpVersion: string | null
  compression: string | null
  technologies: string[]
}

interface DomainIntel {
  age: string | null
  registrar: string | null
  organization: string | null
  subdomains: number
  dnsComplexity: "basic" | "moderate" | "advanced"
  hasCDN: boolean
  ipCount: number
}

interface PerformanceInsights {
  avgResponseTime: number
  avgTTFB: number
  avgDownloadTime: number
  performanceGrade: "A" | "B" | "C" | "D" | "F"
  serverLoad: "light" | "moderate" | "heavy" | "overloaded"
  consistency: number
}

interface ContentInsights {
  avgPageSize: string
  compressionEnabled: boolean
  contentChangeRate: string
  seoScore: number
  hasMetaTags: boolean
  hasOpenGraph: boolean
  hasRobotsTag: boolean
  hasFavicon: boolean
}

function getTrafficLevel(score: number): TrafficEstimate["trafficLevel"] {
  if (score >= 85) return "very_high"
  if (score >= 65) return "high"
  if (score >= 40) return "medium"
  if (score >= 20) return "low"
  return "very_low"
}

function estimateDailyVisits(score: number, contentLength: number | null): string {
  const base = score * 10
  const sizeMultiplier = contentLength && contentLength > 500000 ? 1.5 : contentLength && contentLength > 100000 ? 1.2 : 1
  const estimated = Math.round(base * sizeMultiplier)
  if (estimated < 100) return "< 100"
  if (estimated < 1000) return `${Math.round(estimated / 100) * 100}+`
  if (estimated < 10000) return `${(estimated / 1000).toFixed(1)}K+`
  if (estimated < 100000) return `${Math.round(estimated / 1000)}K+`
  return `${(estimated / 1000000).toFixed(1)}M+`
}

function detectTechnology(headers: Record<string, string>, body: string): TechInfo {
  const server = headers["server"] || null
  const poweredBy = headers["x-powered-by"] || null
  const cdn = headers["cf-ray"] ? "Cloudflare" : headers["x-amz-cf-id"] ? "AWS CloudFront" : headers["x-fastly-request-id"] ? "Fastly" : headers["x-cdn"] || null
  const caching = headers["cache-control"] || null
  const compression = headers["content-encoding"] || null
  const httpVersion = headers["alt-svc"]?.includes("h3") ? "HTTP/3" : headers["alt-svc"]?.includes("h2") ? "HTTP/2" : null
  const ssl = headers["strict-transport-security"] ? "HSTS" : null

  let framework: string | null = null
  const technologies: string[] = []

  if (poweredBy?.includes("Next.js")) { framework = "Next.js"; technologies.push("Next.js") }
  else if (poweredBy?.includes("Express")) { framework = "Express.js"; technologies.push("Express") }
  else if (poweredBy?.includes("PHP")) { framework = "PHP"; technologies.push("PHP") }
  else if (poweredBy?.includes("ASP.NET")) { framework = "ASP.NET"; technologies.push("ASP.NET") }
  else if (poweredBy?.includes("Ruby")) { framework = "Ruby on Rails"; technologies.push("Ruby on Rails") }
  else if (poweredBy?.includes("Python")) { framework = "Python"; technologies.push("Python") }
  else if (poweredBy?.includes("Django")) { framework = "Django"; technologies.push("Django") }
  else if (poweredBy?.includes("Laravel")) { framework = "Laravel"; technologies.push("Laravel") }

  if (server?.includes("nginx")) technologies.push("Nginx")
  else if (server?.includes("Apache")) technologies.push("Apache")
  else if (server?.includes("Microsoft-IIS")) technologies.push("IIS")
  else if (server?.includes("LiteSpeed")) technologies.push("LiteSpeed")
  else if (server?.includes("cloudflare")) technologies.push("Cloudflare")

  if (body.includes("wp-content") || body.includes("wordpress")) technologies.push("WordPress")
  if (body.includes("shopify")) technologies.push("Shopify")
  if (body.includes("wix.com")) technologies.push("Wix")
  if (body.includes("squarespace")) technologies.push("Squarespace")
  if (body.includes("react") || body.includes("__NEXT_DATA__")) technologies.push("React")
  if (body.includes("vue") || body.includes("__NUXT__")) technologies.push("Vue.js")
  if (body.includes("angular")) technologies.push("Angular")
  if (body.includes("jquery")) technologies.push("jQuery")
  if (body.includes("bootstrap")) technologies.push("Bootstrap")
  if (body.includes("tailwind")) technologies.push("Tailwind CSS")

  if (cdn) technologies.push(cdn)
  if (compression) technologies.push(compression.toUpperCase())

  return { server, poweredBy, framework, cdn, caching, ssl, httpVersion, compression, technologies: [...new Set(technologies)] }
}

function analyzeDomain(checks: any[], domainInfo: any): DomainIntel {
  const ips = new Set<string>()
  checks.forEach(c => {
    if (c.resolvedIps) {
      try { JSON.parse(c.resolvedIps).forEach((ip: string) => ips.add(ip)) } catch {}
    }
    if (c.primaryIp) ips.add(c.primaryIp)
  })

  const age = domainInfo?.creationDate
    ? `${Math.floor((Date.now() - new Date(domainInfo.creationDate).getTime()) / (365.25 * 24 * 60 * 60 * 1000))} years`
    : null

  let dnsComplexity: DomainIntel["dnsComplexity"] = "basic"
  if (ips.size > 5) dnsComplexity = "advanced"
  else if (ips.size > 2) dnsComplexity = "moderate"

  const hasCDN = checks.some(c => {
    const headers = c.responseHeaders ? JSON.parse(c.responseHeaders) : {}
    return !!(headers["cf-ray"] || headers["x-amz-cf-id"] || headers["x-fastly-request-id"])
  })

  return {
    age,
    registrar: domainInfo?.registrar || null,
    organization: domainInfo?.organization || null,
    subdomains: 0,
    dnsComplexity,
    hasCDN,
    ipCount: ips.size,
  }
}

function analyzePerformance(checks: any[]): PerformanceInsights {
  const validChecks = checks.filter(c => c.responseTime > 0)
  if (validChecks.length === 0) {
    return { avgResponseTime: 0, avgTTFB: 0, avgDownloadTime: 0, performanceGrade: "F", serverLoad: "light", consistency: 0 }
  }

  const avgResponseTime = Math.round(validChecks.reduce((s, c) => s + c.responseTime, 0) / validChecks.length)
  const avgTTFB = Math.round(validChecks.filter(c => c.ttfb).reduce((s, c) => s + c.ttfb, 0) / (validChecks.filter(c => c.ttfb).length || 1))
  const avgDownloadTime = Math.round(validChecks.filter(c => c.downloadTime).reduce((s, c) => s + c.downloadTime, 0) / (validChecks.filter(c => c.downloadTime).length || 1))

  let performanceGrade: PerformanceInsights["performanceGrade"] = "F"
  if (avgResponseTime < 200) performanceGrade = "A"
  else if (avgResponseTime < 500) performanceGrade = "B"
  else if (avgResponseTime < 1000) performanceGrade = "C"
  else if (avgResponseTime < 3000) performanceGrade = "D"

  let serverLoad: PerformanceInsights["serverLoad"] = "light"
  if (avgTTFB > 2000) serverLoad = "overloaded"
  else if (avgTTFB > 1000) serverLoad = "heavy"
  else if (avgTTFB > 500) serverLoad = "moderate"

  const times = validChecks.map(c => c.responseTime)
  const mean = times.reduce((a, b) => a + b, 0) / times.length
  const variance = times.reduce((s, t) => s + Math.pow(t - mean, 2), 0) / times.length
  const stdDev = Math.sqrt(variance)
  const consistency = Math.max(0, Math.min(100, Math.round(100 - (stdDev / mean) * 100)))

  return { avgResponseTime, avgTTFB, avgDownloadTime, performanceGrade, serverLoad, consistency }
}

function analyzeContent(checks: any[]): ContentInsights {
  const withContent = checks.filter(c => c.contentLength > 0)
  const avgPageSize = withContent.length > 0
    ? formatBytes(Math.round(withContent.reduce((s, c) => s + c.contentLength, 0) / withContent.length))
    : "Unknown"

  const compressionEnabled = checks.some(c => c.compression)

  const changeChecks = checks.filter(c => c.contentChanged !== null && c.contentChanged !== undefined)
  const changedCount = changeChecks.filter(c => c.contentChanged).length
  const contentChangeRate = changeChecks.length > 0
    ? `${Math.round((changedCount / changeChecks.length) * 100)}%`
    : "N/A"

  let seoScore = 0
  const latest = checks[0]
  if (latest) {
    if (latest.pageTitle) seoScore += 20
    if (latest.metaDescription) seoScore += 20
    if (latest.canonicalUrl) seoScore += 15
    if (latest.ogTitle) seoScore += 15
    if (latest.ogDescription) seoScore += 10
    if (latest.hasFavicon) seoScore += 5
    if (latest.robotsTag) seoScore += 5
    if (latest.hsts) seoScore += 10
  }

  return {
    avgPageSize,
    compressionEnabled,
    contentChangeRate,
    seoScore,
    hasMetaTags: !!latest?.pageTitle,
    hasOpenGraph: !!latest?.ogTitle,
    hasRobotsTag: !!latest?.robotsTag,
    hasFavicon: !!latest?.hasFavicon,
  }
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B"
  const k = 1024
  const sizes = ["B", "KB", "MB", "GB"]
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
}

export async function getTrafficEstimate(websiteId: string): Promise<TrafficEstimate> {
  const website = await prisma.website.findUnique({ where: { id: websiteId } })
  if (!website) throw new Error("Website not found")

  const [checks, domainInfo, aggregations, incidents, baseline] = await Promise.all([
    prisma.websiteCheck.findMany({ where: { websiteId }, orderBy: { checkedAt: "desc" }, take: 200 }),
    prisma.domainInfo.findUnique({ where: { websiteId } }),
    prisma.dailyAggregation.findMany({ where: { websiteId }, orderBy: { date: "desc" }, take: 30 }),
    prisma.incident.findMany({ where: { websiteId }, orderBy: { startedAt: "desc" }, take: 20 }),
    prisma.responseTimeBaseline.findUnique({ where: { websiteId } }),
  ])

  const techStack = checks.length > 0 ? detectTechnology(
    checks[0].responseHeaders ? JSON.parse(checks[0].responseHeaders) : {},
    checks[0].bodyPreview || ""
  ) : { server: null, poweredBy: null, framework: null, cdn: null, caching: null, ssl: null, httpVersion: null, compression: null, technologies: [] }

  const domainIntel = analyzeDomain(checks, domainInfo)
  const performance = analyzePerformance(checks)
  const content = analyzeContent(checks)

  const signals: TrafficSignal[] = []
  let totalScore = 0
  let totalWeight = 0

  // Signal 1: Response time (servers handling traffic have optimized response times)
  const perfScore = performance.performanceGrade === "A" ? 90 : performance.performanceGrade === "B" ? 75 : performance.performanceGrade === "C" ? 50 : performance.performanceGrade === "D" ? 25 : 10
  signals.push({ name: "Server Performance", score: perfScore, weight: 20, description: `Grade ${performance.performanceGrade} — avg ${performance.avgResponseTime}ms response`, icon: "zap" })
  totalScore += perfScore * 20; totalWeight += 20

  // Signal 2: Content size (larger sites = more content = more traffic potential)
  const latestCheck = checks[0]
  const contentSize = latestCheck?.contentLength || 0
  const sizeScore = contentSize > 1000000 ? 90 : contentSize > 500000 ? 80 : contentSize > 100000 ? 65 : contentSize > 10000 ? 40 : contentSize > 0 ? 20 : 30
  signals.push({ name: "Content Volume", score: sizeScore, weight: 15, description: `Avg page size: ${content.avgPageSize}`, icon: "file" })
  totalScore += sizeScore * 15; totalWeight += 15

  // Signal 3: Content change frequency (active sites update more)
  const changeRate = content.contentChangeRate !== "N/A" ? parseInt(content.contentChangeRate) : 50
  const changeScore = changeRate > 30 ? 85 : changeRate > 15 ? 70 : changeRate > 5 ? 50 : changeRate > 0 ? 30 : 40
  signals.push({ name: "Content Freshness", score: changeScore, weight: 20, description: `Content changes ${content.contentChangeRate} of checks`, icon: "refresh" })
  totalScore += changeScore * 20; totalWeight += 20

  // Signal 4: Infrastructure complexity (CDN, multiple IPs, etc.)
  const infraScore = (domainIntel.hasCDN ? 30 : 0) + (domainIntel.ipCount > 5 ? 25 : domainIntel.ipCount > 2 ? 15 : 5) + (techStack.cdn ? 15 : 0) + (performance.consistency > 80 ? 15 : performance.consistency > 50 ? 10 : 5) + (techStack.httpVersion ? 10 : 0)
  const infraScoreClamped = Math.min(100, infraScore)
  signals.push({ name: "Infrastructure", score: infraScoreClamped, weight: 15, description: `${domainIntel.ipCount} IPs, ${domainIntel.hasCDN ? "CDN detected" : "no CDN"}, ${domainIntel.dnsComplexity} DNS`, icon: "server" })
  totalScore += infraScoreClamped * 15; totalWeight += 15

  // Signal 5: SEO maturity (well-optimized sites get more organic traffic)
  const seoScore = content.seoScore
  signals.push({ name: "SEO Maturity", score: seoScore, weight: 15, description: `SEO score ${seoScore}/100 — ${content.hasMetaTags ? "meta tags ✓" : "no meta tags"}`, icon: "search" })
  totalScore += seoScore * 15; totalWeight += 15

  // Signal 6: Domain authority (older = more established)
  const domainAge = domainIntel.age ? parseInt(domainIntel.age) : 5
  const ageScore = domainAge > 15 ? 90 : domainAge > 10 ? 75 : domainAge > 5 ? 60 : domainAge > 2 ? 40 : 20
  signals.push({ name: "Domain Authority", score: ageScore, weight: 15, description: `Domain age: ${domainIntel.age || "unknown"}${domainIntel.registrar ? `, ${domainIntel.registrar}` : ""}`, icon: "shield" })
  totalScore += ageScore * 15; totalWeight += 15

  const trafficScore = totalWeight > 0 ? Math.round(totalScore / totalWeight) : 0
  const trafficLevel = getTrafficLevel(trafficScore)
  const estimatedDailyVisits = estimateDailyVisits(trafficScore, latestCheck?.contentLength || null)

  const confidence: TrafficEstimate["confidence"] = checks.length > 100 ? "high" : checks.length > 30 ? "medium" : "low"

  // Additional DNS check
  let additionalIPs = 0
  try {
    const aRecords = await dns.promises.resolve4(website.url.includes("://") ? new URL(website.url).hostname : website.url).catch(() => [])
    additionalIPs = aRecords.length
  } catch {}

  if (additionalIPs > domainIntel.ipCount) {
    domainIntel.ipCount = additionalIPs
  }

  return {
    trafficScore,
    trafficLevel,
    estimatedDailyVisits,
    confidence,
    signals,
    techStack,
    domainIntelligence: domainIntel,
    performanceInsights: performance,
    contentInsights: content,
  }
}
