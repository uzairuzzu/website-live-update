import dns from "dns"

const PUBLIC_DNS_RESOLVERS = [
  { name: "Google (8.8.8.8)", resolver: "8.8.8.8" },
  { name: "Cloudflare (1.1.1.1)", resolver: "1.1.1.1" },
  { name: "Quad9 (9.9.9.9)", resolver: "9.9.9.9" },
  { name: "OpenDNS (208.67.222.222)", resolver: "208.67.222.222" },
  { name: "Level3 (4.2.2.1)", resolver: "4.2.2.1" },
]

export interface DNSPropagationResult {
  hostname: string
  records: {
    resolver: string
    resolverName: string
    ips: string[]
    error: string | null
    responseTime: number
  }[]
  consistent: boolean
  totalResolvers: number
  successfulResolvers: number
}

function resolveWithResolver(hostname: string, resolver: string): Promise<{ ips: string[]; error: string | null; responseTime: number }> {
  return new Promise((resolve) => {
    const start = Date.now()
    const resolverObj = new dns.Resolver()
    resolverObj.setServers([resolver])
    resolverObj.resolve4(hostname, (err, addresses) => {
      const responseTime = Date.now() - start
      if (err) {
        resolve({ ips: [], error: err.message, responseTime })
      } else {
        resolve({ ips: addresses.sort(), error: null, responseTime })
      }
    })
  })
}

export async function checkDNSPropagation(hostname: string): Promise<DNSPropagationResult> {
  const results = await Promise.all(
    PUBLIC_DNS_RESOLVERS.map(async (r) => {
      const result = await resolveWithResolver(hostname, r.resolver)
      return {
        resolver: r.resolver,
        resolverName: r.name,
        ...result,
      }
    })
  )

  const successfulResults = results.filter(r => r.ips.length > 0)
  const allIps = successfulResults.map(r => r.ips.join(","))
  const consistent = allIps.length > 0 && allIps.every(ip => ip === allIps[0])

  return {
    hostname,
    records: results,
    consistent,
    totalResolvers: results.length,
    successfulResolvers: successfulResults.length,
  }
}
