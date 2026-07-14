import { prisma } from "@/lib/prisma"

export interface BudgetCheckResult {
  budget: {
    responseTimeThreshold: number
    ttfbThreshold: number
    downloadTimeThreshold: number
    uptimeTarget: number
  }
  violations: { metric: string; value: number; threshold: number; severity: string }[]
  compliant: boolean
}

export async function getPerformanceBudget(websiteId: string) {
  return prisma.performanceBudget.findUnique({ where: { websiteId } })
}

export async function upsertPerformanceBudget(websiteId: string, data: {
  responseTimeThreshold?: number
  ttfbThreshold?: number
  downloadTimeThreshold?: number
  uptimeTarget?: number
  enabled?: boolean
}) {
  return prisma.performanceBudget.upsert({
    where: { websiteId },
    create: { websiteId, ...data },
    update: data,
  })
}

export async function checkPerformanceBudget(websiteId: string): Promise<BudgetCheckResult | null> {
  const budget = await prisma.performanceBudget.findUnique({ where: { websiteId } })
  if (!budget || !budget.enabled) return null

  const recentChecks = await prisma.websiteCheck.findMany({
    where: { websiteId },
    orderBy: { checkedAt: "desc" },
    take: 20,
  })

  if (recentChecks.length === 0) return null

  const avgResponseTime = Math.round(recentChecks.reduce((s, c) => s + (c.responseTime || 0), 0) / recentChecks.length)
  const avgTTFB = Math.round(recentChecks.filter(c => c.ttfb).reduce((s, c) => s + (c.ttfb || 0), 0) / (recentChecks.filter(c => c.ttfb).length || 1))
  const avgDownload = Math.round(recentChecks.filter(c => c.downloadTime).reduce((s, c) => s + (c.downloadTime || 0), 0) / (recentChecks.filter(c => c.downloadTime).length || 1))

  const onlineChecks = recentChecks.filter(c => c.status === "online").length
  const uptime = Math.round((onlineChecks / recentChecks.length) * 100 * 100) / 100

  const violations: BudgetCheckResult["violations"] = []

  if (avgResponseTime > budget.responseTimeThreshold) {
    violations.push({ metric: "Response Time", value: avgResponseTime, threshold: budget.responseTimeThreshold, severity: avgResponseTime > budget.responseTimeThreshold * 2 ? "critical" : "warning" })
  }
  if (avgTTFB > budget.ttfbThreshold) {
    violations.push({ metric: "TTFB", value: avgTTFB, threshold: budget.ttfbThreshold, severity: avgTTFB > budget.ttfbThreshold * 2 ? "critical" : "warning" })
  }
  if (avgDownload > budget.downloadTimeThreshold) {
    violations.push({ metric: "Download Time", value: avgDownload, threshold: budget.downloadTimeThreshold, severity: avgDownload > budget.downloadTimeThreshold * 2 ? "critical" : "warning" })
  }
  if (uptime < budget.uptimeTarget) {
    violations.push({ metric: "Uptime", value: uptime, threshold: budget.uptimeTarget, severity: uptime < budget.uptimeTarget - 5 ? "critical" : "warning" })
  }

  if (violations.length > 0) {
    for (const v of violations) {
      const existing = await prisma.notification.findFirst({
        where: { websiteId, type: "budget_violation", message: { contains: v.metric } },
      })
      if (!existing) {
        await prisma.notification.create({
          data: { websiteId, type: "budget_violation", message: `${v.metric} exceeded: ${v.value}${v.metric === "Uptime" ? "%" : "ms"} (threshold: ${v.threshold}${v.metric === "Uptime" ? "%" : "ms"})`, severity: v.severity },
        })
      }
    }
  }

  return {
    budget: {
      responseTimeThreshold: budget.responseTimeThreshold,
      ttfbThreshold: budget.ttfbThreshold,
      downloadTimeThreshold: budget.downloadTimeThreshold,
      uptimeTarget: budget.uptimeTarget,
    },
    violations,
    compliant: violations.length === 0,
  }
}
