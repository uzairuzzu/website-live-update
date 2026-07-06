export interface DashboardStats {
  totalWebsites: number
  online: number
  offline: number
  averageResponseTime: number
  sslExpiring: number
  uptime: number
  totalDowntime: number
  lastIncident: string | null
}

export interface WebsiteWithDetails {
  id: string
  name: string
  url: string
  status: string
  interval: number
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
  checkedAt: string
}

export interface IncidentData {
  id: string
  websiteId: string
  startedAt: string
  endedAt: string | null
  duration: number | null
  resolved: boolean
}

export interface AnalyticsData {
  responseTimes: { date: string; time: number; website: string }[]
  uptimeData: { website: string; uptime: number }[]
  dailyDowntime: { date: string; downtime: number }[]
}
