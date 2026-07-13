import { prisma } from "@/lib/prisma"

export async function getKeywords(websiteId: string) {
  return prisma.keyword.findMany({ where: { websiteId }, orderBy: { createdAt: "desc" } })
}

export async function createKeyword(data: {
  websiteId: string; keyword: string; mode: string; enabled?: boolean
}) {
  return prisma.keyword.create({ data: { ...data, enabled: data.enabled ?? true } })
}

export async function updateKeyword(id: string, data: Partial<{
  keyword: string; mode: string; enabled: boolean
}>) {
  return prisma.keyword.update({ where: { id }, data })
}

export async function deleteKeyword(id: string) {
  return prisma.keyword.delete({ where: { id } })
}

export async function checkKeywords(websiteId: string, body: string): Promise<string[]> {
  const keywords = await prisma.keyword.findMany({ where: { websiteId, enabled: true } })
  const alerts: string[] = []
  for (const kw of keywords) {
    const found = body.toLowerCase().includes(kw.keyword.toLowerCase())
    const matched = kw.mode === "present" ? found : !found
    await prisma.keyword.update({
      where: { id: kw.id },
      data: { lastMatch: matched, lastChecked: new Date() },
    })
    if (!matched) {
      alerts.push(`Keyword "${kw.keyword}" expected to be ${kw.mode} but was not`)
    }
  }
  return alerts
}
