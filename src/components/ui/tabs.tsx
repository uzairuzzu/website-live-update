"use client"
import { useState } from "react"

export function Tabs({ tabs, children }: { tabs: { id: string; label: string }[]; children: React.ReactNode }) {
  const [active, setActive] = useState(tabs[0]?.id || "")
  return (
    <div>
      <div className="flex gap-1 border-b border-[var(--border)] mb-6">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setActive(t.id)}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-[1px] ${
              active === t.id
                ? "border-[var(--primary)] text-[var(--primary)]"
                : "border-transparent text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tabs.map(t => (
        <div key={t.id} style={{ display: active === t.id ? "block" : "none" }}>
          {children}
        </div>
      ))}
    </div>
  )
}
