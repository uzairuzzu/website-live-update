import { prisma } from "@/lib/prisma"

export interface AnomalyResult {
  isAnomaly: boolean
  deviation: number
  mean: number
  stdDeviation: number
}

export async function calculateBaseline(websiteId: string): Promise<{ mean: number; stdDeviation: number; sampleCount: number }> {
  const checks = await prisma.websiteCheck.findMany({
    where: { websiteId, responseTime: { not: null }, status: "online" },
    orderBy: { checkedAt: "desc" },
    take: 100,
    select: { responseTime: true },
  })

  const times = checks.map(c => c.responseTime!).filter(t => t > 0)
  if (times.length < 5) return { mean: 0, stdDeviation: 0, sampleCount: times.length }

  const mean = times.reduce((a, b) => a + b, 0) / times.length
  const variance = times.reduce((sum, t) => sum + Math.pow(t - mean, 2), 0) / times.length
  const stdDeviation = Math.sqrt(variance)

  await prisma.responseTimeBaseline.upsert({
    where: { websiteId },
    update: { mean, stdDeviation, sampleCount: times.length, lastCalculated: new Date() },
    create: { websiteId, mean, stdDeviation, sampleCount: times.length },
  })

  return { mean, stdDeviation, sampleCount: times.length }
}

export async function detectAnomaly(websiteId: string, responseTime: number): Promise<AnomalyResult> {
  let baseline = await prisma.responseTimeBaseline.findUnique({ where: { websiteId } })

  if (!baseline || baseline.sampleCount < 10) {
    const fresh = await calculateBaseline(websiteId)
    baseline = await prisma.responseTimeBaseline.findUnique({ where: { websiteId } })
    if (!baseline) return { isAnomaly: false, deviation: 0, mean: fresh.mean, stdDeviation: fresh.stdDeviation }
  }

  if (baseline.stdDeviation === 0) {
    return { isAnomaly: false, deviation: 0, mean: baseline.mean, stdDeviation: 0 }
  }

  const deviation = (responseTime - baseline.mean) / baseline.stdDeviation
  const isAnomaly = deviation > 2

  return { isAnomaly, deviation, mean: baseline.mean, stdDeviation: baseline.stdDeviation }
}
