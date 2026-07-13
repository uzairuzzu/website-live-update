export interface DashboardStats {
  totalWebsites: number
  online: number
  offline: number
  degraded: number
  averageResponseTime: number
  sslExpiring: number
  weakSsl: number
  uptime: number
  totalDowntime: number
  lastIncident: string | null
  anomalies: number
}

export interface WebsiteWithDetails {
  id: string
  name: string
  url: string
  status: string
  interval: number
  monitorType: string
  sensitivity: string
  slaTarget: number
  consecutiveFailures: number
  responseTime: number | null
  sslStatus: string | null
  sslExpiry: string | null
  lastChecked: string | null
  createdAt: string
}

export interface DetailedCheck {
  id: string
  status: string
  statusCode: number | null
  responseTime: number | null
  dnsTime: number | null
  tcpTime: number | null
  tlsTime: number | null
  ttfb: number | null
  downloadTime: number | null
  contentLength: number | null
  contentType: string | null
  redirectCount: number | null
  redirectChain: string | null
  headers: string | null
  bodyPreview: string | null
  errorMessage: string | null
  isAnomaly: boolean | null
  anomalyDeviation: number | null
  checkedAt: string
}

export interface DetailedSSL {
  id: string
  websiteId: string
  expiryDate: string
  issuer: string | null
  subjectName: string | null
  validFrom: string | null
  serialNumber: string | null
  fingerprint: string | null
  protocol: string | null
  cipherSuite: string | null
  valid: boolean
  weakProtocol: boolean | null
  weakCipher: boolean | null
  checkedAt: string
}

export interface IncidentData {
  id: string
  websiteId: string
  startedAt: string
  endedAt: string | null
  duration: number | null
  resolved: boolean
  severity: string
  rootCause: string | null
  impactSummary: string | null
  updates: IncidentUpdate[]
}

export interface IncidentUpdate {
  id: string
  incidentId: string
  message: string
  status: string | null
  createdAt: string
}

export interface AnalyticsData {
  responseTimes: { date: string; time: number; website: string; isAnomaly?: boolean }[]
  uptimeData: { website: string; uptime: number; slaTarget?: number }[]
  dailyDowntime: { date: string; downtime: number }[]
  aggregations: { website: string; date: string; avgResponseTime: number; uptimePercent: number; totalChecks: number; incidentCount: number }[]
}

export interface SLAReport {
  websiteId: string
  name: string
  url: string
  period: string
  totalChecks: number
  onlineChecks: number
  uptime: number
  slaTarget: number
  slaMet: boolean
  totalDowntime: number
  incidentCount: number
  daily: { date: string; uptime: number }[]
}

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

export interface DomainInfo {
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

export interface ExternalCheckResult {
  status: "online" | "offline" | "unknown"
  responseTime: number | null
  statusCode: number | null
  provider: string
  message: string
  checkedAt: Date
}

export interface ExternalProviderConfig {
  id: string
  name: string
  type: "uptimerobot" | "betterstack" | "freshping"
  enabled: boolean
  createdAt: string
}
