"use client"

import { useState } from "react"
import { Sidebar } from "@/components/sidebar/Sidebar"
import { Navbar } from "@/components/navbar/Navbar"
import { MonitorProvider } from "@/components/MonitorProvider"
import { useSession } from "next-auth/react"
import { redirect } from "next/navigation"

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const { data: session, status } = useSession()

  if (status === "loading") {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[var(--background)]">
        <div className="w-8 h-8 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!session) {
    redirect("/login")
  }

  return (
    <div className="flex h-screen bg-[var(--background)]">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Navbar onMenuClick={() => setSidebarOpen(true)} />
        <MonitorProvider>
          <main className="flex-1 overflow-y-auto p-4 md:p-6">{children}</main>
        </MonitorProvider>
      </div>
    </div>
  )
}
