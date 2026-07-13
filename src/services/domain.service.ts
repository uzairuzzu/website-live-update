import { prisma } from "@/lib/prisma"

export interface DomainCheckResult {
  domain: string
  registrar: string | null
  organization: string | null
  creationDate: string | null
  expiryDate: string | null
  daysUntilExpiry: number | null
  nameServers: string[]
  dnssec: boolean | null
  status: string | null
  alert: string | null
}

function extractDomainFromUrl(url: string): string {
  try {
    const parsed = new URL(url)
    return parsed.hostname.replace(/^www\./, "")
  } catch {
    return url.replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0]
  }
}

export async function checkDomainInfo(websiteId: string): Promise<DomainCheckResult | null> {
  const website = await prisma.website.findUnique({ where: { id: websiteId } })
  if (!website) return null

  const domain = extractDomainFromUrl(website.url)

  try {
    const response = await fetch(
      `https://rdap.verisign.com/com/v1/domain/${domain}`,
      { signal: AbortSignal.timeout(10000) }
    ).catch(() => null)

    if (!response || !response.ok) {
      return await fallbackDomainCheck(websiteId, domain)
    }

    const data = await response.json()

    const registrar = data.entities?.find((e: any) =>
      e.roles?.includes("registrar")
    )?.vcardArray?.[1]?.find((v: any) => v[0] === "fn")?.[3] || null

    const organization = data.entities?.find((e: any) =>
      e.roles?.includes("registrant")
    )?.vcardArray?.[1]?.find((v: any) => v[0] === "org")?.[3] || null

    const events = data.events || []
    const creationEvent = events.find((e: any) => e.eventAction === "registration")
    const expiryEvent = events.find((e: any) => e.eventAction === "expiration")

    const creationDate = creationEvent?.eventDate || null
    const expiryDate = expiryEvent?.eventDate || null

    const nameServers = (data.nameservers || []).map((ns: any) =>
      ns.ldhName || ns.handle || ""
    ).filter(Boolean)

    const status = (data.status || []).join(", ") || null

    let daysUntilExpiry: number | null = null
    let alert: string | null = null
    if (expiryDate) {
      const expDate = new Date(expiryDate)
      daysUntilExpiry = Math.floor((expDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
      if (daysUntilExpiry < 0) alert = "Domain has expired"
      else if (daysUntilExpiry < 7) alert = `Domain expires in ${daysUntilExpiry} days`
      else if (daysUntilExpiry < 30) alert = `Domain expires in ${daysUntilExpiry} days`
    }

    await prisma.domainInfo.upsert({
      where: { websiteId },
      update: {
        domain, registrar, organization, creationDate: creationDate ? new Date(creationDate) : null,
        expiryDate: expiryDate ? new Date(expiryDate) : null, nameServers: JSON.stringify(nameServers),
        status, checkedAt: new Date(),
      },
      create: {
        websiteId, domain, registrar, organization, creationDate: creationDate ? new Date(creationDate) : null,
        expiryDate: expiryDate ? new Date(expiryDate) : null, nameServers: JSON.stringify(nameServers),
        status, checkedAt: new Date(),
      },
    })

    return { domain, registrar, organization, creationDate, expiryDate, daysUntilExpiry, nameServers, dnssec: null, status, alert }
  } catch {
    return await fallbackDomainCheck(websiteId, domain)
  }
}

async function fallbackDomainCheck(websiteId: string, domain: string): Promise<DomainCheckResult> {
  await prisma.domainInfo.upsert({
    where: { websiteId },
    update: { domain, checkedAt: new Date() },
    create: { websiteId, domain, checkedAt: new Date() },
  })
  return { domain, registrar: null, organization: null, creationDate: null, expiryDate: null, daysUntilExpiry: null, nameServers: [], dnssec: null, status: null, alert: null }
}

export async function getDomainInfo(websiteId: string) {
  return prisma.domainInfo.findUnique({ where: { websiteId } })
}
