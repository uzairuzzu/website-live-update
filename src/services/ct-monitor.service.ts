import { prisma } from "@/lib/prisma"
import https from "https"

export interface CTLogEntry {
  domain: string
  issuerName: string
  serialNumber: string
  notBefore: string
  notAfter: string
  fingerprint: string
  isKnown: boolean
}

export async function checkCertificateTransparency(websiteId: string): Promise<CTLogEntry[]> {
  const website = await prisma.website.findUnique({ where: { id: websiteId } })
  if (!website) return []

  const hostname = new URL(website.url.includes("://") ? website.url : `https://${website.url}`).hostname
  const knownCerts = await prisma.certificateLog.findMany({ where: { websiteId }, orderBy: { detectedAt: "desc" } })

  return new Promise((resolve) => {
    const startTime = Date.now()
    const req = https.get(`https://crt.sh/?q=${hostname}&output=json`, { timeout: 10000 }, (res) => {
      let body = ""
      res.on("data", (chunk: Buffer) => { body += chunk.toString() })
      res.on("end", () => {
        try {
          const data = JSON.parse(body)
          const seen = new Set<string>()
          const entries: CTLogEntry[] = []

          for (const cert of data.slice(0, 50)) {
            const serial = cert.serial_number || ""
            if (seen.has(serial)) continue
            seen.add(serial)

            const isKnown = knownCerts.some(k => k.serialNumber === serial)
            entries.push({
              domain: cert.common_name || hostname,
              issuerName: cert.issuer_name || "Unknown",
              serialNumber: serial,
              notBefore: cert.not_before || "",
              notAfter: cert.not_after || "",
              fingerprint: cert.fingerprint256 || cert.fingerprint || "",
              isKnown,
            })
          }

          for (const entry of entries) {
            if (!entry.isKnown) {
              const existing = await prisma.certificateLog.findFirst({ where: { websiteId, serialNumber: entry.serialNumber } })
              if (!existing) {
                await prisma.certificateLog.create({
                  data: {
                    websiteId, domain: entry.domain, issuerName: entry.issuerName,
                    serialNumber: entry.serialNumber,
                    notBefore: new Date(entry.notBefore || Date.now()),
                    notAfter: new Date(entry.notAfter || Date.now()),
                    fingerprint: entry.fingerprint,
                  },
                })
                const existingNotification = await prisma.notification.findFirst({
                  where: { websiteId, type: "ct_alert", message: { contains: entry.serialNumber.slice(0, 12) } },
                })
                if (!existingNotification) {
                  await prisma.notification.create({
                    data: { websiteId, type: "ct_alert", message: `New certificate detected: ${entry.issuerName} (serial: ${entry.serialNumber.slice(0, 12)}...)`, severity: "medium" },
                  })
                }
              }
            }
          }

          resolve(entries)
        } catch {
          resolve([])
        }
      })
    })
    req.on("error", () => resolve([]))
    req.on("timeout", () => { req.destroy(); resolve([]) })
  })
}

export async function getKnownCertificates(websiteId: string) {
  return prisma.certificateLog.findMany({ where: { websiteId }, orderBy: { detectedAt: "desc" }, take: 50 })
}
