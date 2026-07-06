"use client"

import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import { Edit, Trash2, ExternalLink } from "lucide-react"
import { formatDate } from "@/lib/utils"

interface WebsiteRow {
  id: string
  name: string
  url: string
  status: string
  responseTime: number | null
  sslStatus: string | null
  lastChecked: string | null
}

interface WebsitesTableProps {
  websites: WebsiteRow[]
  loading?: boolean
  onDelete?: (id: string) => void
}

export function WebsitesTable({ websites, loading, onDelete }: WebsitesTableProps) {
  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-14 w-full" />
        ))}
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-[var(--border)]">
            <th className="text-left py-3 px-4 font-medium text-[var(--muted-foreground)]">Name</th>
            <th className="text-left py-3 px-4 font-medium text-[var(--muted-foreground)]">URL</th>
            <th className="text-left py-3 px-4 font-medium text-[var(--muted-foreground)]">Status</th>
            <th className="text-left py-3 px-4 font-medium text-[var(--muted-foreground)]">Response</th>
            <th className="text-left py-3 px-4 font-medium text-[var(--muted-foreground)]">SSL</th>
            <th className="text-left py-3 px-4 font-medium text-[var(--muted-foreground)]">Last Checked</th>
            <th className="text-right py-3 px-4 font-medium text-[var(--muted-foreground)]">Action</th>
          </tr>
        </thead>
        <tbody>
          {websites.map((w) => (
            <tr
              key={w.id}
              className="border-b border-[var(--border)] hover:bg-[var(--accent)]/50 transition-colors"
            >
              <td className="py-3 px-4">
                <Link
                  href={`/websites/${w.id}`}
                  className="font-medium text-[var(--foreground)] hover:text-[var(--primary)]"
                >
                  {w.name}
                </Link>
              </td>
              <td className="py-3 px-4">
                <a
                  href={w.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-[var(--muted-foreground)] hover:text-[var(--primary)]"
                >
                  {w.url.replace(/^https?:\/\//, "").slice(0, 30)}
                  <ExternalLink className="w-3 h-3" />
                </a>
              </td>
              <td className="py-3 px-4">
                <Badge variant={w.status === "online" ? "online" : w.status === "offline" ? "offline" : "default"}>
                  {w.status}
                </Badge>
              </td>
              <td className="py-3 px-4 text-[var(--foreground)]">
                {w.responseTime ? `${w.responseTime}ms` : "—"}
              </td>
              <td className="py-3 px-4">
                <Badge variant={w.sslStatus === "valid" ? "online" : w.sslStatus === "expiring" ? "warning" : "default"}>
                  {w.sslStatus || "Unknown"}
                </Badge>
              </td>
              <td className="py-3 px-4 text-[var(--muted-foreground)]">
                {w.lastChecked ? formatDate(w.lastChecked) : "—"}
              </td>
              <td className="py-3 px-4 text-right">
                <div className="flex items-center justify-end gap-1">
                  <Link href={`/websites/${w.id}`}>
                    <Button variant="ghost" size="sm">
                      <Edit className="w-3.5 h-3.5" />
                    </Button>
                  </Link>
                  {onDelete && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onDelete(w.id)}
                    >
                      <Trash2 className="w-3.5 h-3.5 text-[var(--destructive)]" />
                    </Button>
                  )}
                </div>
              </td>
            </tr>
          ))}
          {websites.length === 0 && (
            <tr>
              <td colSpan={7} className="py-8 text-center text-[var(--muted-foreground)]">
                No websites added yet
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
