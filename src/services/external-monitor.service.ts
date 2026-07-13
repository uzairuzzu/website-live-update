import { prisma } from "@/lib/prisma"
import https from "https"
import http from "http"

export interface ExternalCheckResult {
  status: "online" | "offline" | "unknown"
  responseTime: number | null
  statusCode: number | null
  provider: string
  message: string
  checkedAt: Date
}

interface ProviderConfig {
  id: string
  name: string
  type: string
  apiKey: string
  enabled: boolean
}

const FETCH_TIMEOUT = 30000

function fetchJson(url: string, headers: Record<string, string>): Promise<any> {
  return new Promise((resolve, reject) => {
    const start = Date.now()
    const mod = url.startsWith("https") ? https : http
    const req = mod.get(url, { headers, timeout: FETCH_TIMEOUT }, (res) => {
      let body = ""
      res.on("data", (chunk: Buffer) => { body += chunk.toString() })
      res.on("end", () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(body), elapsed: Date.now() - start })
        } catch {
          reject(new Error(`Invalid JSON from provider: ${body.slice(0, 200)}`))
        }
      })
    })
    req.on("error", reject)
    req.on("timeout", () => { req.destroy(); reject(new Error("Provider request timed out")) })
  })
}

function postJson(url: string, headers: Record<string, string>, body: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const start = Date.now()
    const mod = url.startsWith("https") ? https : http
    const parsed = new URL(url)
    const req = mod.request({
      hostname: parsed.hostname,
      port: parsed.port,
      path: parsed.pathname + parsed.search,
      method: "POST",
      headers: { ...headers, "Content-Type": "application/x-www-form-urlencoded", "Content-Length": Buffer.byteLength(body) },
      timeout: FETCH_TIMEOUT,
    }, (res) => {
      let data = ""
      res.on("data", (chunk: Buffer) => { data += chunk.toString() })
      res.on("end", () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data), elapsed: Date.now() - start })
        } catch {
          reject(new Error(`Invalid JSON from provider: ${data.slice(0, 200)}`))
        }
      })
    })
    req.on("error", reject)
    req.on("timeout", () => { req.destroy(); reject(new Error("Provider request timed out")) })
    req.end(body)
  })
}

async function checkUptimeRobot(apiKey: string, url: string): Promise<ExternalCheckResult> {
  try {
    const encodedUrl = encodeURIComponent(url)

    const monitorsRes = await fetchJson(
      `https://api.uptimerobot.com/v2/getMonitors?api_key=${apiKey}&url=${encodedUrl}&response_times=1&limit=1`,
      { "Cache-Control": "no-cache" }
    )

    if (monitorsRes.data.stat !== "ok" || !monitorsRes.data.monitors?.length) {
      const newMonitor = await postJson(
        "https://api.uptimerobot.com/v2/newMonitor",
        { "Cache-Control": "no-cache" },
        `api_key=${apiKey}&url=${encodedUrl}&type=1&friendly_name=${encodeURIComponent(new URL(url).hostname)}`
      )

      if (newMonitor.data.stat !== "ok") {
        return { status: "unknown", responseTime: null, statusCode: null, provider: "uptimerobot", message: `Failed to create monitor: ${newMonitor.data.message || "unknown error"}`, checkedAt: new Date() }
      }

      return { status: "unknown", responseTime: null, statusCode: null, provider: "uptimerobot", message: "Monitor created — first check will appear within 5 minutes", checkedAt: new Date() }
    }

    const monitor = monitorsRes.data.monitors[0]
    const statusMap: Record<number, ExternalCheckResult["status"]> = { 2: "online", 9: "offline", 8: "offline", 0: "unknown", 1: "unknown" }
    const responseTime = monitor.response_times?.[0]?.value || null

    return {
      status: statusMap[monitor.status] || "unknown",
      responseTime,
      statusCode: monitor.status === 2 ? 200 : monitor.status === 9 ? 0 : null,
      provider: "uptimerobot",
      message: monitor.status === 2 ? "Up" : monitor.status === 9 ? "Down" : monitor.status === 8 ? "Paused" : `Status code: ${monitor.status}`,
      checkedAt: new Date(),
    }
  } catch (err: any) {
    return { status: "unknown", responseTime: null, statusCode: null, provider: "uptimerobot", message: `Error: ${err.message}`, checkedAt: new Date() }
  }
}

async function checkBetterStack(apiKey: string, url: string): Promise<ExternalCheckResult> {
  try {
    const monitorsRes = await fetchJson(
      "https://api.betterstack.com/v3/monitors",
      { Authorization: `Bearer ${apiKey}` }
    )

    const existing = monitorsRes.data?.data?.find((m: any) => m.attributes?.url === url)

    if (!existing) {
      const createRes = await new Promise<any>((resolve, reject) => {
        const mod = https
        const body = JSON.stringify({ url, name: new URL(url).hostname, period: 300 })
        const req = mod.request("https://api.betterstack.com/v3/monitors", {
          method: "POST",
          headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json", "Content-Length": Buffer.byteLength(body) },
          timeout: FETCH_TIMEOUT,
        }, (res) => {
          let data = ""
          res.on("data", (c: Buffer) => { data += c.toString() })
          res.on("end", () => { try { resolve(JSON.parse(data)) } catch { reject(new Error("Invalid response")) } })
        })
        req.on("error", reject)
        req.on("timeout", () => { req.destroy(); reject(new Error("Timed out")) })
        req.end(body)
      })

      if (createRes.data?.id) {
        return { status: "unknown", responseTime: null, statusCode: null, provider: "betterstack", message: "Monitor created — first check will appear shortly", checkedAt: new Date() }
      }
      return { status: "unknown", responseTime: null, statusCode: null, provider: "betterstack", message: `Failed: ${createRes.errors?.[0]?.detail || "unknown"}`, checkedAt: new Date() }
    }

    const statusRes = await fetchJson(
      `https://api.betterstack.com/v3/monitors/${existing.id}/metrics`,
      { Authorization: `Bearer ${apiKey}` }
    )

    const latest = statusRes.data?.data?.attributes?.metrics?.[0]
    const isUp = latest?.uptime !== undefined ? latest.uptime > 99 : existing.attributes?.status === "up"

    return {
      status: isUp ? "online" : "offline",
      responseTime: latest?.response_time ? Math.round(latest.response_time) : null,
      statusCode: isUp ? 200 : 0,
      provider: "betterstack",
      message: isUp ? "Up" : "Down",
      checkedAt: new Date(),
    }
  } catch (err: any) {
    return { status: "unknown", responseTime: null, statusCode: null, provider: "betterstack", message: `Error: ${err.message}`, checkedAt: new Date() }
  }
}

async function checkFreshping(apiKey: string, url: string): Promise<ExternalCheckResult> {
  try {
    const checksRes = await fetchJson(
      "https://api.freshping.io/v1/checks",
      { "X-Api-Key": apiKey }
    )

    const checks = checksRes.data?.checks || checksRes.data || []
    const existing = Array.isArray(checks) ? checks.find((c: any) => c.check_url === url || c.url === url) : null

    if (!existing) {
      return { status: "unknown", responseTime: null, statusCode: null, provider: "freshping", message: "URL not found in Freshping — add it manually at freshping.io", checkedAt: new Date() }
    }

    const isUp = existing.state === "T" || existing.status === "up"
    return {
      status: isUp ? "online" : "offline",
      responseTime: existing.response_time ? Math.round(existing.response_time) : null,
      statusCode: isUp ? 200 : 0,
      provider: "freshping",
      message: isUp ? "Up" : `Down (${existing.state || "unknown"})`,
      checkedAt: new Date(),
    }
  } catch (err: any) {
    return { status: "unknown", responseTime: null, statusCode: null, provider: "freshping", message: `Error: ${err.message}`, checkedAt: new Date() }
  }
}

export async function checkExternalProvider(userId: string, url: string, providerId?: string): Promise<ExternalCheckResult> {
  let providers: ProviderConfig[]

  if (providerId) {
    const p = await prisma.externalProvider.findFirst({ where: { id: providerId, userId, enabled: true } })
    if (!p) return { status: "unknown", responseTime: null, statusCode: null, provider: "none", message: "Provider not found or disabled", checkedAt: new Date() }
    providers = [p]
  } else {
    providers = await prisma.externalProvider.findMany({ where: { userId, enabled: true } })
  }

  if (providers.length === 0) {
    return { status: "unknown", responseTime: null, statusCode: null, provider: "none", message: "No external monitoring providers configured — add one in Settings", checkedAt: new Date() }
  }

  for (const provider of providers) {
    let result: ExternalCheckResult
    switch (provider.type) {
      case "uptimerobot":
        result = await checkUptimeRobot(provider.apiKey, url)
        break
      case "betterstack":
        result = await checkBetterStack(provider.apiKey, url)
        break
      case "freshping":
        result = await checkFreshping(provider.apiKey, url)
        break
      default:
        continue
    }
    if (result.status !== "unknown") return result
  }

  return { status: "unknown", responseTime: null, statusCode: null, provider: providers[0].type, message: "All providers returned unknown status", checkedAt: new Date() }
}

export async function getExternalProviders(userId: string) {
  return prisma.externalProvider.findMany({
    where: { userId },
    select: { id: true, name: true, type: true, enabled: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  })
}

export async function createExternalProvider(userId: string, data: { name: string; type: string; apiKey: string }) {
  return prisma.externalProvider.create({
    data: { userId, name: data.name, type: data.type, apiKey: data.apiKey },
    select: { id: true, name: true, type: true, enabled: true, createdAt: true },
  })
}

export async function updateExternalProvider(userId: string, id: string, data: { name?: string; apiKey?: string; enabled?: boolean }) {
  return prisma.externalProvider.updateMany({
    where: { id, userId },
    data,
  })
}

export async function deleteExternalProvider(userId: string, id: string) {
  return prisma.externalProvider.deleteMany({ where: { id, userId } })
}
