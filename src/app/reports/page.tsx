"use client"

import { Card, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { FileText, Download, Calendar } from "lucide-react"

const reports = [
  { title: "Monthly Uptime Report", period: "June 2026", type: "PDF" },
  { title: "Response Time Analysis", period: "Last 30 Days", type: "CSV" },
  { title: "SSL Certificate Report", period: "All Websites", type: "PDF" },
  { title: "Incident Summary", period: "Last Quarter", type: "PDF" },
]

export default function ReportsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[var(--foreground)]">Reports</h1>
        <p className="text-sm text-[var(--muted-foreground)]">
          Download performance reports
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {reports.map((r) => (
          <Card key={r.title}>
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-[var(--primary)]/10 flex items-center justify-center">
                  <FileText className="w-5 h-5 text-[var(--primary)]" />
                </div>
                <div>
                  <CardTitle className="text-[var(--foreground)] font-medium text-sm">
                    {r.title}
                  </CardTitle>
                  <div className="flex items-center gap-1 mt-1 text-xs text-[var(--muted-foreground)]">
                    <Calendar className="w-3 h-3" />
                    {r.period}
                  </div>
                </div>
              </div>
              <Button variant="secondary" size="sm">
                <Download className="w-3.5 h-3.5 mr-1" />
                {r.type}
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  )
}
