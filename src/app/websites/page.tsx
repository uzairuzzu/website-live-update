"use client"

import { useEffect, useState } from "react"
import { Card, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { WebsitesTable } from "@/components/tables/WebsitesTable"
import { Plus, Search, X } from "lucide-react"
import toast from "react-hot-toast"

interface Website {
  id: string
  name: string
  url: string
  status: string
  interval: number
  checks: { statusCode: number | null; responseTime: number | null; checkedAt: string }[]
  ssl: { valid: boolean; expiryDate: string } | null
  incidents: { id: string }[]
}

export default function WebsitesPage() {
  const [websites, setWebsites] = useState<Website[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState({ name: "", url: "", interval: 5 })

  useEffect(() => {
    fetchWebsites()
  }, [])

  async function fetchWebsites() {
    try {
      const res = await fetch("/api/websites")
      const data = await res.json()
      setWebsites(data)
    } catch {
      toast.error("Failed to load websites")
    } finally {
      setLoading(false)
    }
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    try {
      const res = await fetch("/api/websites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      })
      if (!res.ok) {
        const data = await res.json()
        toast.error(data.error || "Failed to add website")
        return
      }
      toast.success("Website added!")
      setShowAdd(false)
      setForm({ name: "", url: "", interval: 5 })
      fetchWebsites()
    } catch {
      toast.error("Something went wrong")
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Are you sure you want to delete this website?")) return
    try {
      await fetch(`/api/websites/${id}`, { method: "DELETE" })
      toast.success("Website deleted")
      fetchWebsites()
    } catch {
      toast.error("Failed to delete")
    }
  }

  const filtered = websites.filter(
    (w) =>
      w.name.toLowerCase().includes(search.toLowerCase()) ||
      w.url.toLowerCase().includes(search.toLowerCase())
  )

  const tableData = filtered.map((w) => ({
    id: w.id,
    name: w.name,
    url: w.url,
    status: w.status,
    responseTime: w.checks[0]?.responseTime ?? null,
    sslStatus: w.ssl
      ? w.ssl.valid
        ? new Date(w.ssl.expiryDate).getTime() - Date.now() < 30 * 24 * 60 * 60 * 1000
          ? "expiring"
          : "valid"
        : "invalid"
      : null,
    lastChecked: w.checks[0]?.checkedAt ?? null,
  }))

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--foreground)]">Websites</h1>
          <p className="text-sm text-[var(--muted-foreground)]">
            Manage your monitored websites
          </p>
        </div>
        <Button onClick={() => setShowAdd(true)}>
          <Plus className="w-4 h-4 mr-1.5" />
          Add Website
        </Button>
      </div>

      {showAdd && (
        <Card>
          <CardHeader>
            <CardTitle>Add New Website</CardTitle>
            <Button variant="ghost" size="sm" onClick={() => setShowAdd(false)}>
              <X className="w-4 h-4" />
            </Button>
          </CardHeader>
          <form onSubmit={handleAdd} className="p-5 pt-0 space-y-4">
            <div className="grid md:grid-cols-3 gap-4">
              <Input
                id="name"
                label="Website Name"
                placeholder="My Portfolio"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />
              <Input
                id="url"
                label="Website URL"
                type="url"
                placeholder="https://example.com"
                value={form.url}
                onChange={(e) => setForm({ ...form, url: e.target.value })}
                required
              />
              <Input
                id="interval"
                label="Check Interval (minutes)"
                type="number"
                min={1}
                value={form.interval}
                onChange={(e) =>
                  setForm({ ...form, interval: parseInt(e.target.value) || 5 })
                }
              />
            </div>
            <Button type="submit">Save Website</Button>
          </form>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>All Websites</CardTitle>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--muted-foreground)]" />
            <input
              className="h-9 w-64 rounded-lg border border-[var(--input)] bg-[var(--background)] pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
              placeholder="Search websites..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </CardHeader>
        <WebsitesTable
          websites={tableData}
          loading={loading}
          onDelete={handleDelete}
        />
      </Card>
    </div>
  )
}
