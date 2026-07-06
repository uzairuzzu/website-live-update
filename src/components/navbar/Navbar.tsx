"use client"

import { useTheme } from "@/components/ui/theme-provider"
import { signOut, useSession } from "next-auth/react"
import { Menu, Moon, Sun, LogOut, User, Bell } from "lucide-react"
import Link from "next/link"
import { useState } from "react"

export function Navbar({ onMenuClick }: { onMenuClick: () => void }) {
  const { theme, toggleTheme } = useTheme()
  const { data: session } = useSession()
  const [dropdownOpen, setDropdownOpen] = useState(false)

  return (
    <header className="sticky top-0 z-30 bg-[var(--background)] border-b border-[var(--border)]">
      <div className="flex items-center justify-between px-4 md:px-6 h-16">
        <button
          onClick={onMenuClick}
          className="md:hidden p-2 rounded-lg hover:bg-[var(--accent)] text-[var(--muted-foreground)]"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="flex-1" />

        <div className="flex items-center gap-2">
          <button
            onClick={toggleTheme}
            className="p-2 rounded-lg hover:bg-[var(--accent)] text-[var(--muted-foreground)]"
          >
            {theme === "dark" ? (
              <Sun className="w-4.5 h-4.5" />
            ) : (
              <Moon className="w-4.5 h-4.5" />
            )}
          </button>

          <Link
            href="/notifications"
            className="p-2 rounded-lg hover:bg-[var(--accent)] text-[var(--muted-foreground)]"
          >
            <Bell className="w-4.5 h-4.5" />
          </Link>

          <div className="relative">
            <button
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-[var(--accent)]"
            >
              <div className="w-7 h-7 rounded-full bg-[var(--primary)] flex items-center justify-center text-xs font-medium text-white">
                {session?.user?.name?.charAt(0)?.toUpperCase() || "U"}
              </div>
            </button>

            {dropdownOpen && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setDropdownOpen(false)}
                />
                <div className="absolute right-0 top-full mt-1 w-48 bg-[var(--card)] border border-[var(--border)] rounded-xl shadow-lg z-20 py-1">
                  <div className="px-3 py-2 border-b border-[var(--border)]">
                    <p className="text-sm font-medium text-[var(--foreground)]">
                      {session?.user?.name || "User"}
                    </p>
                    <p className="text-xs text-[var(--muted-foreground)]">
                      {session?.user?.email}
                    </p>
                  </div>
                  <Link
                    href="/profile"
                    onClick={() => setDropdownOpen(false)}
                    className="flex items-center gap-2 px-3 py-2 text-sm text-[var(--foreground)] hover:bg-[var(--accent)]"
                  >
                    <User className="w-4 h-4" />
                    Profile
                  </Link>
                  <button
                    onClick={() => signOut()}
                    className="flex items-center gap-2 px-3 py-2 text-sm text-[var(--destructive)] hover:bg-[var(--accent)] w-full"
                  >
                    <LogOut className="w-4 h-4" />
                    Sign Out
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}
