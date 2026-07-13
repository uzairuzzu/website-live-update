import { cn } from "@/lib/utils"

interface BadgeProps {
  variant?: "online" | "offline" | "warning" | "default" | "secondary"
  children: React.ReactNode
  className?: string
}

export function Badge({ variant = "default", children, className }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium",
        {
          "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400":
            variant === "online",
          "bg-red-500/10 text-red-600 dark:text-red-400":
            variant === "offline",
          "bg-amber-500/10 text-amber-600 dark:text-amber-400":
            variant === "warning",
          "bg-[var(--secondary)] text-[var(--secondary-foreground)]":
            variant === "default" || variant === "secondary",
        },
        className
      )}
    >
      {variant === "online" && (
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5" />
      )}
      {variant === "offline" && (
        <span className="w-1.5 h-1.5 rounded-full bg-red-500 mr-1.5" />
      )}
      {children}
    </span>
  )
}
