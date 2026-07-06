import { Card, CardTitle, CardValue } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { LucideIcon } from "lucide-react"

interface DashboardCardProps {
  title: string
  value: string | number
  icon: LucideIcon
  trend?: string
  loading?: boolean
}

export function DashboardCard({ title, value, icon: Icon, trend, loading }: DashboardCardProps) {
  if (loading) {
    return (
      <Card>
        <div className="space-y-3">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-8 w-16" />
        </div>
      </Card>
    )
  }

  return (
    <Card>
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <CardTitle>{title}</CardTitle>
          <CardValue>{value}</CardValue>
          {trend && (
            <p className="text-xs text-[var(--muted-foreground)]">{trend}</p>
          )}
        </div>
        <div className="w-10 h-10 rounded-lg bg-[var(--primary)]/10 flex items-center justify-center">
          <Icon className="w-5 h-5 text-[var(--primary)]" />
        </div>
      </div>
    </Card>
  )
}
